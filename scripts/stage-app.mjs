import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import asar from "@electron/asar";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staged = join(root, ".stage-app");
const output = join(root, "release", "win-unpacked");
const electronDist = existsSync(join(root, ".cache", "electron-dist", "electron.exe"))
    ? join(root, ".cache", "electron-dist")
    : join(root, "node_modules", "electron", "dist");

if (!existsSync(join(electronDist, "electron.exe"))) {
    console.error("Electron binary missing. Run `node node_modules/electron/install.js` first.");
    process.exit(1);
}

if (existsSync(output)) {
    rmSync(output, { recursive: true, force: true });
}

cpSync(electronDist, output, { recursive: true });
renameSync(join(output, "electron.exe"), join(output, "Notely.exe"));
rmSync(join(output, "resources", "default_app.asar"), { force: true });

rmSync(staged, { recursive: true, force: true });
mkdirSync(staged, { recursive: true });

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const stagePackage = {
    name: pkg.name,
    productName: pkg.productName,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    license: pkg.license,
    main: pkg.main,
    dependencies: pkg.dependencies
};
writeFileSync(join(staged, "package.json"), JSON.stringify(stagePackage, null, 4));

for (const entry of ["dist", "dist-electron", "assets"]) {
    cpSync(join(root, entry), join(staged, entry), { recursive: true });
}

await asar.createPackage(staged, join(output, "resources", "app.asar"));
rmSync(staged, { recursive: true, force: true });

console.log("Staged application at", output);
