# ─────────────────────────────────────────────────────────────────────────────
# Notely - Windows Explorer context menu
#
# Adds three entries when the user right-clicks a folder or the Desktop:
#
#   Notely - Create New Task    -> notely.exe --app-task
#   Notely - Create New Notes   -> notely.exe --app-note
#   Notely - Create New TXT     -> notely.exe --app-txt   (writes newfile.txt)
#
# electron-builder's `nsis` section cannot express these keys, so the installer
# runs this script after the files are in place. It is written to be safe to run
# more than once: every key is deleted first and then re-created, so upgrades
# never leave stale paths behind.
#
# Usage (from the NSIS installer's post-install hook):
#   powershell -NoProfile -ExecutionPolicy Bypass -File context-menu.ps1 `
#       -ExePath "$INSTDIR\Notely.exe" -Mode Install
#   powershell ... -Mode Uninstall
#
# `$HIVE` decides user scope vs. machine scope. The installer passes
# -PerMachine when it was started elevated for "all users"; otherwise the keys
# go into HKEY_CURRENT_USER.
# ─────────────────────────────────────────────────────────────────────────────

param(
    [Parameter(Mandatory = $true)]
    [string]$ExePath,

    [ValidateSet("Install", "Uninstall")]
    [string]$Mode = "Install",

    # Write to HKLM (all users) instead of HKCU (current user).
    [switch]$PerMachine
)

$ErrorActionPreference = "Stop"

$hive = if ($PerMachine) { "HKLM" } else { "HKCU" }
$base = "${hive}:\Software\Classes"

# Context-menu entries. `*` = any file, `Directory` = a folder, `Directory\Background`
# = empty space inside a folder, `DesktopBackground` = the desktop itself.
$targets = @(
    "Software\Classes\*\shell",
    "Software\Classes\Directory\shell",
    "Software\Classes\Directory\Background\shell",
    "Software\Classes\DesktopBackground\Shell"
)

$verbs = @(
    @{ Key = "Notely.CreateTask";  Label = "Notely - Create New Task";  Args = "--app-task" },
    @{ Key = "Notely.CreateNotes"; Label = "Notely - Create New Notes"; Args = "--app-note" },
    @{ Key = "Notely.CreateTxt";   Label = "Notely - Create New TXT";   Args = "--app-txt" }
)

function Remove-NotelyKeys {
    foreach ($target in $targets) {
        $path = "${hive}:\$target"
        foreach ($verb in $verbs) {
            $key = Join-Path $path $verb.Key
            if (Test-Path -LiteralPath $key) {
                Remove-Item -LiteralPath $key -Recurse -Force
            }
        }
    }

    # ─── FILE ASSOCIATIONS ───────────────────────────────────────────────────
    # A ProgID is the identity Windows stores for "this application opens this
    # kind of document". Without it, `.txt` / `.md` stay owned by Notepad (or by
    # nothing at all for `.md`), which is why double-clicking a file never
    # reached Notely — the "Open with" entry alone does not change the default.
    foreach ($extension in @(".txt", ".md", ".markdown")) {
        $openWith = "${hive}:\Software\Classes\SystemFileAssociations\$extension\shell\Notely.Open"
        if (Test-Path -LiteralPath $openWith) {
            Remove-Item -LiteralPath $openWith -Recurse -Force
        }
        $newWith = "${hive}:\Software\Classes\$extension\NotelyNew"
        if (Test-Path -LiteralPath $newWith) {
            Remove-Item -LiteralPath $newWith -Recurse -Force
        }
        # Remove the ProgID and the extension link, but only if they still point
        # at Notely — never clobber a ProgID the user chose for something else.
        $progId = "Notely$extension"
        $progKey = "${hive}:\Software\Classes\$progId"
        if (Test-Path -LiteralPath $progKey) {
            Remove-Item -LiteralPath $progKey -Recurse -Force
        }
        $extKey = "${hive}:\Software\Classes\$extension"
        $currentProgId = (Get-ItemProperty -LiteralPath $extKey -Name "(Default)" -ErrorAction SilentlyContinue)."(default)"
        if ($currentProgId -eq $progId) {
            Remove-ItemProperty -LiteralPath $extKey -Name "(Default)" -ErrorAction SilentlyContinue
        }
        # Drop the advertised handler without touching the other entries.
        $openWithProgids = Join-Path $extKey "OpenWithProgids"
        if (Test-Path -LiteralPath $openWithProgids) {
            Remove-ItemProperty -LiteralPath $openWithProgids -Name $progId -ErrorAction SilentlyContinue
        }
    }
}

function Install-NotelyKeys {
    if (-not (Test-Path -LiteralPath $ExePath)) {
        Write-Warning "Notely.exe not found at '$ExePath'; skipping the context menu."
        return
    }

    foreach ($target in $targets) {
        $path = "${hive}:\$target"
        New-Item -Path $path -Force | Out-Null
        foreach ($verb in $verbs) {
            $key = Join-Path $path $verb.Key
            New-Item -Path $key -Force | Out-Null
            # `(Default)` is the text Explorer shows in the menu.
            Set-ItemProperty -LiteralPath $key -Name "(Default)" -Value $verb.Label
            # An icon makes the entries easier to spot among Explorer's own.
            Set-ItemProperty -LiteralPath $key -Name "Icon" -Value "`"$ExePath`",0"

            $command = Join-Path $key "command"
            New-Item -Path $command -Force | Out-Null
            # `%V` = the clicked folder/desktop, so the working directory is the
            # place the user right-clicked and `newfile.txt` lands there.
            Set-ItemProperty -LiteralPath $command -Name "(Default)" `
                -Value "`"$ExePath`" $($verb.Args) `"%V`""
        }
    }

    # ─── FILE ASSOCIATIONS ───────────────────────────────────────────────────
    # Register a ProgID for each supported extension and point Windows at it.
    # This is what makes double-clicking `notes.txt` or `todo.md` open Notely.
    #
    # Note on `.txt`: Windows 10/11 keeps the user's choice in
    # `Explorer\FileExts\.txt\UserChoice`, which cannot be written by an
    # installer (it is hash-signed by Explorer). Writing the `Classes\.txt`
    # ProgID still registers Notely as a real handler, so it appears in the
    # "Open with" list and in Settings > Default apps; the user confirms once
    # with "Always use this app".
    foreach ($extension in @(".txt", ".md", ".markdown")) {
        # `$extension` already starts with a dot, so the ProgID must not add one.
        $progId = "Notely$extension"
        $description = if ($extension -eq ".txt") { "Plain text document" } else { "Markdown document" }

        # 1. The ProgID itself: how to open it, what to call it, which icon.
        $progKey = "${hive}:\Software\Classes\$progId"
        New-Item -Path $progKey -Force | Out-Null
        Set-ItemProperty -LiteralPath $progKey -Name "(Default)" -Value $description
        $progCommand = Join-Path $progKey "shell\open\command"
        New-Item -Path $progCommand -Force | Out-Null
        Set-ItemProperty -LiteralPath $progCommand -Name "(Default)" -Value "`"$ExePath`" `"%1`""
        $progIcon = Join-Path $progKey "DefaultIcon"
        New-Item -Path $progIcon -Force | Out-Null
        Set-ItemProperty -LiteralPath $progIcon -Name "(Default)" -Value "`"$ExePath`",0"

        # 2. Point the extension at that ProgID. Windows honours this whenever
        #    the user has not pinned a different app in UserChoice.
        $extKey = "${hive}:\Software\Classes\$extension"
        New-Item -Path $extKey -Force | Out-Null
        Set-ItemProperty -LiteralPath $extKey -Name "(Default)" -Value $progId
        # Advertise the content type so Explorer and browsers treat it right.
        $contentType = if ($extension -eq ".txt") { "text/plain" } else { "text/markdown" }
        Set-ItemProperty -LiteralPath $extKey -Name "Content Type" -Value $contentType
        New-Item -Path (Join-Path $extKey "OpenWithProgids") -Force | Out-Null
        # An empty value marks the ProgID as a known handler for the extension.
        New-ItemProperty -LiteralPath (Join-Path $extKey "OpenWithProgids") -Name $progId -Value "" -PropertyType String -Force | Out-Null

        # 3. Keep the explicit "Open with Notely" entry so the app is reachable
        #    even while Notepad still owns the double-click.
        $openWith = "${hive}:\Software\Classes\SystemFileAssociations\$extension\shell\Notely.Open"
        New-Item -Path $openWith -Force | Out-Null
        Set-ItemProperty -LiteralPath $openWith -Name "(Default)" -Value "Open with Notely"
        Set-ItemProperty -LiteralPath $openWith -Name "Icon" -Value "`"$ExePath`",0"
        $openCommand = Join-Path $openWith "command"
        New-Item -Path $openCommand -Force | Out-Null
        Set-ItemProperty -LiteralPath $openCommand -Name "(Default)" -Value "`"$ExePath`" `"%1`""

        # 4. Explorer's "New > Notely Note" entry for this extension.
        $newWith = "${hive}:\Software\Classes\$extension\NotelyNew"
        New-Item -Path $newWith -Force | Out-Null
        Set-ItemProperty -LiteralPath $newWith -Name "(Default)" -Value "Notely Note"
        Set-ItemProperty -LiteralPath $newWith -Name "Icon" -Value "`"$ExePath`",0"
        $template = Join-Path $newWith "shell\open\command"
        New-Item -Path $template -Force | Out-Null
        # Reuse the icon and label but start a blank note rather than opening a
        # file that does not exist yet.
        Set-ItemProperty -LiteralPath $template -Name "(Default)" -Value "`"$ExePath`" --app-note"
    }

    # 5. Tell Explorer the associations changed so the new handler appears
    #    without waiting for a reboot.
    try {
        Add-Type -Namespace Win32 -Name Shell -MemberDefinition @'
[DllImport("shell32.dll")] public static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
'@ -ErrorAction Stop
        [Win32.Shell]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)
    } catch {
        # Non-fatal: Explorer will notice on its next restart.
    }
}

try {
    Remove-NotelyKeys
    if ($Mode -eq "Install") {
        Install-NotelyKeys
    }
    Write-Host "Notely context menu: $Mode complete ($hive)."
    exit 0
} catch {
    Write-Warning "Notely context menu $Mode failed: $($_.Exception.Message)"
    # Never fail the installer because of a missing registry right; the app
    # itself is already installed at this point.
    exit 0
}
