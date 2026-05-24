const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const TAG = '[universal-serial-sdk]';

// Resolve the user's project root (3 levels up from node_modules/universal-serial-sdk/scripts/)
const projectRoot    = path.resolve(__dirname, '../../..');
const rootBuildGradle = path.join(projectRoot, 'android', 'build.gradle');
const appBuildGradle  = path.join(projectRoot, 'android', 'app', 'build.gradle');

let anyFailed = false;

// ── Windows Build Tools Check ─────────────────────────────────────────────────
if (os.platform() === 'win32') {
    console.log(`${TAG} Windows environment detected, checking build tools...`);

    let hasBuildTools = false;

    try {
        execSync('node-gyp --version', { stdio: 'ignore' });
        hasBuildTools = true;
    } catch (e) {}

    if (!hasBuildTools) {
        try {
            // Check for cl.exe (Visual C++ compiler) in common install paths
            execSync('where cl.exe', { stdio: 'ignore' });
            hasBuildTools = true;
        } catch (e) {}
    }

    if (hasBuildTools) {
        console.log(`${TAG} ✅ Windows Build Tools detected.`);
    } else {
        console.warn(`${TAG} ⚠️  Windows Build Tools not detected.`);
        console.warn(`${TAG}    If you plan to use NodeSerialBridge or ElectronSerialBridge,`);
        console.warn(`${TAG}    you need to install build tools before running: npm install serialport`);
        console.warn(`${TAG}`);
        console.warn(`${TAG}    Option A (Recommended): Install Visual Studio Build Tools`);
        console.warn(`${TAG}    https://visualstudio.microsoft.com/visual-cpp-build-tools/`);
        console.warn(`${TAG}`);
        console.warn(`${TAG}    Option B: Run as Administrator:`);
        console.warn(`${TAG}    npm install --global windows-build-tools`);
        console.warn(`${TAG}`);
        console.warn(`${TAG}    Note: Capacitor and Cordova users do NOT need this.`);
    }
}

// ── Android Gradle Patching (Capacitor projects only) ─────────────────────────
// Skip if not a Capacitor/Cordova project (no android/ folder)
if (!fs.existsSync(path.join(projectRoot, 'android'))) {
    console.log(`${TAG} No android/ folder found, skipping Gradle setup.`);
    console.log(`${TAG} ✅ JS SDK ready. Import from 'universal-serial-sdk'.`);
    process.exit(0);
}

// ── 1. Add JitPack to android/build.gradle ───────────────────────────────────
if (fs.existsSync(rootBuildGradle)) {
    try {
        let content = fs.readFileSync(rootBuildGradle, 'utf8');
        const jitpack = `        maven { url 'https://jitpack.io' }`;

        if (content.includes('jitpack.io')) {
            console.log(`${TAG} JitPack already present in android/build.gradle, skipped.`);
        } else {
            const patched = content.replace(
                /(allprojects\s*\{[\s\S]*?repositories\s*\{)/,
                `$1\n${jitpack}`
            );
            if (patched === content) {
                console.warn(`${TAG} ⚠️  Could not locate allprojects > repositories in android/build.gradle.`);
                console.warn(`${TAG}    Please add manually inside allprojects > repositories:`);
                console.warn(`${TAG}    ${jitpack}`);
                anyFailed = true;
            } else {
                fs.writeFileSync(rootBuildGradle, patched, 'utf8');
                console.log(`${TAG} ✅ Added JitPack to android/build.gradle`);
            }
        }
    } catch (e) {
        console.warn(`${TAG} ⚠️  Failed to patch android/build.gradle: ${e.message}`);
        anyFailed = true;
    }
} else {
    console.warn(`${TAG} ⚠️  android/build.gradle not found.`);
    anyFailed = true;
}

// ── 2. Add SerialPort dependency to android/app/build.gradle ─────────────────
if (fs.existsSync(appBuildGradle)) {
    try {
        let content = fs.readFileSync(appBuildGradle, 'utf8');
        const dep = `    implementation 'com.github.licheedev:Android-SerialPort-API:2.0.0'`;

        if (content.includes('Android-SerialPort-API')) {
            console.log(`${TAG} Android-SerialPort-API already present in android/app/build.gradle, skipped.`);
        } else {
            const patched = content.replace(
                /(dependencies\s*\{)/,
                `$1\n${dep}`
            );
            if (patched === content) {
                console.warn(`${TAG} ⚠️  Could not locate dependencies block in android/app/build.gradle.`);
                console.warn(`${TAG}    Please add manually inside dependencies {}:`);
                console.warn(`${TAG}    ${dep}`);
                anyFailed = true;
            } else {
                fs.writeFileSync(appBuildGradle, patched, 'utf8');
                console.log(`${TAG} ✅ Added Android-SerialPort-API to android/app/build.gradle`);
            }
        }
    } catch (e) {
        console.warn(`${TAG} ⚠️  Failed to patch android/app/build.gradle: ${e.message}`);
        anyFailed = true;
    }
} else {
    console.warn(`${TAG} ⚠️  android/app/build.gradle not found.`);
    anyFailed = true;
}

// ── Summary ───────────────────────────────────────────────────────────────────
if (anyFailed) {
    console.warn(`${TAG} ⚠️  Some steps could not complete automatically. Check warnings above.`);
} else {
    console.log(`${TAG} ✅ Setup complete! Run: npx cap sync`);
}
