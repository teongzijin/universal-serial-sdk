const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const TAG = '[universal-serial-sdk]';

// ── Find project root ─────────────────────────────────────────────────────────
function findProjectRoot() {
    const candidates = [
        process.env.INIT_CWD,
        path.resolve(__dirname, '../../..'),
        path.resolve(__dirname, '../..'),
        process.cwd(),
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'android'))) {
            return candidate;
        }
    }
    return null;
}

const projectRoot     = findProjectRoot();
const rootBuildGradle = projectRoot ? path.join(projectRoot, 'android', 'build.gradle') : null;
const appBuildGradle  = projectRoot ? path.join(projectRoot, 'android', 'app', 'build.gradle') : null;
const settingsGradle  = projectRoot ? path.join(projectRoot, 'android', 'settings.gradle') : null;

let anyFailed = false;

// ── Windows Build Tools Check ─────────────────────────────────────────────────
if (os.platform() === 'win32') {
    console.log(TAG + ' Windows environment detected, checking build tools...');

    let hasBuildTools = false;
    try { execSync('node-gyp --version', { stdio: 'ignore' }); hasBuildTools = true; } catch (e) {}
    if (!hasBuildTools) {
        try { execSync('where cl.exe', { stdio: 'ignore' }); hasBuildTools = true; } catch (e) {}
    }

    if (hasBuildTools) {
        console.log(TAG + ' Windows Build Tools detected.');
    } else {
        console.warn(TAG + ' Windows Build Tools not detected.');
        console.warn(TAG + '    If you plan to use NodeSerialBridge or ElectronSerialBridge,');
        console.warn(TAG + '    you need build tools before running: npm install serialport');
        console.warn(TAG + '    Option A: https://visualstudio.microsoft.com/visual-cpp-build-tools/');
        console.warn(TAG + '    Option B (Admin): npm install --global windows-build-tools');
        console.warn(TAG + '    Note: Capacitor and Cordova users do NOT need this.');
    }
}

// ── Skip if no android folder ─────────────────────────────────────────────────
if (!projectRoot) {
    console.log(TAG + ' No android/ folder found, skipping Gradle setup.');
    console.log(TAG + ' JS SDK ready. Import from universal-serial-sdk.');

    // Still try to copy to www/ if it exists (e.g. Cordova web-only setup)
    copyToWww();
    process.exit(0);
}

console.log(TAG + ' Found project root: ' + projectRoot);

// ── 1. Add JitPack ────────────────────────────────────────────────────────────
const jitpack = "        maven { url 'https://jitpack.io' }";
let jitpackAdded = false;

// Try settings.gradle first (newer Capacitor/Cordova projects)
if (fs.existsSync(settingsGradle)) {
    try {
        let content = fs.readFileSync(settingsGradle, 'utf8');
        if (content.includes('jitpack.io')) {
            console.log(TAG + ' JitPack already present in android/settings.gradle, skipped.');
            jitpackAdded = true;
        } else if (content.includes('dependencyResolutionManagement')) {
            const lines = content.split('\n');
            let inDRM = false, inRepo = false, depth = 0, insertAt = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('dependencyResolutionManagement')) inDRM = true;
                if (inDRM && line.includes('repositories')) inRepo = true;
                if (inDRM || inRepo) {
                    depth += (line.match(/\{/g) || []).length;
                    depth -= (line.match(/\}/g) || []).length;
                }
                if (inRepo && depth >= 2) { insertAt = i + 1; break; }
            }
            if (insertAt > -1) {
                lines.splice(insertAt, 0, jitpack);
                fs.writeFileSync(settingsGradle, lines.join('\n'), 'utf8');
                console.log(TAG + ' Added JitPack to android/settings.gradle');
                jitpackAdded = true;
            }
        }
    } catch (e) {
        console.warn(TAG + ' Failed to patch android/settings.gradle: ' + e.message);
    }
}

// Try build.gradle (older projects)
if (!jitpackAdded && fs.existsSync(rootBuildGradle)) {
    try {
        let content = fs.readFileSync(rootBuildGradle, 'utf8');
        if (content.includes('jitpack.io')) {
            console.log(TAG + ' JitPack already present in android/build.gradle, skipped.');
            jitpackAdded = true;
        } else if (content.includes('allprojects')) {
            const lines = content.split('\n');
            let inAll = false, inRepo = false, depth = 0, insertAt = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!inAll && line.includes('allprojects')) inAll = true;
                if (inAll && !inRepo && line.includes('repositories')) inRepo = true;
                if (inAll) {
                    depth += (line.match(/\{/g) || []).length;
                    depth -= (line.match(/\}/g) || []).length;
                }
                if (inRepo && depth >= 2) { insertAt = i + 1; break; }
            }
            if (insertAt > -1) {
                lines.splice(insertAt, 0, jitpack);
                fs.writeFileSync(rootBuildGradle, lines.join('\n'), 'utf8');
                console.log(TAG + ' Added JitPack to android/build.gradle');
                jitpackAdded = true;
            }
        }
    } catch (e) {
        console.warn(TAG + ' Failed to patch android/build.gradle: ' + e.message);
    }
}

if (!jitpackAdded) {
    console.warn(TAG + ' Could not auto-add JitPack. Please add manually:');
    console.warn(TAG + '    Inside allprojects > repositories in android/build.gradle:');
    console.warn(TAG + '    ' + jitpack);
    anyFailed = true;
}

// ── 2. Add SerialPort dependency to android/app/build.gradle ─────────────────
if (fs.existsSync(appBuildGradle)) {
    try {
        let content = fs.readFileSync(appBuildGradle, 'utf8');
        const dep = "    implementation 'com.github.licheedev:Android-SerialPort-API:2.0.0'";

        if (content.includes('Android-SerialPort-API')) {
            console.log(TAG + ' Android-SerialPort-API already present, skipped.');
        } else {
            const lines = content.split('\n');
            let insertAt = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('dependencies') && lines[i].includes('{')) {
                    insertAt = i + 1;
                    break;
                }
            }
            if (insertAt > -1) {
                lines.splice(insertAt, 0, dep);
                fs.writeFileSync(appBuildGradle, lines.join('\n'), 'utf8');
                console.log(TAG + ' Added Android-SerialPort-API to android/app/build.gradle');
            } else {
                console.warn(TAG + ' Could not locate dependencies block in android/app/build.gradle.');
                console.warn(TAG + '    Please add manually: ' + dep);
                anyFailed = true;
            }
        }
    } catch (e) {
        console.warn(TAG + ' Failed to patch android/app/build.gradle: ' + e.message);
        anyFailed = true;
    }
} else {
    console.warn(TAG + ' android/app/build.gradle not found.');
    anyFailed = true;
}

// ── 3. Copy SDK src to www/sdk (Capacitor & Cordova) ─────────────────────────
copyToWww();

// ── Summary ───────────────────────────────────────────────────────────────────
if (anyFailed) {
    console.warn(TAG + ' Some steps could not complete automatically. Check warnings above.');
} else {
    console.log(TAG + ' Setup complete! Run: npx cap sync');
}

// ── Helper: copy src/ to www/sdk/ ─────────────────────────────────────────────
function copyToWww() {
    if (!projectRoot) return;

    const wwwDir = path.join(projectRoot, 'www');
    const wwwSdk = path.join(wwwDir, 'sdk');
    const sdkSrc = path.join(__dirname, '..', 'src');

    if (!fs.existsSync(wwwDir)) {
        console.log(TAG + ' No www/ folder found, skipping SDK copy.');
        console.log(TAG + '    Node.js/Electron users: import directly from node_modules.');
        return;
    }

    try {
        copyDirSync(sdkSrc, wwwSdk);
        console.log(TAG + ' Copied SDK src to www/sdk/');
        console.log(TAG + '    Use in your HTML:');
        console.log(TAG + '    import { UniversalSerialClient, CapacitorAndroidBridge, SampleLockerDriver }');
        console.log(TAG + "        from './sdk/index.js';");
    } catch (e) {
        console.warn(TAG + ' Failed to copy SDK to www/sdk/: ' + e.message);
    }
}

function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
