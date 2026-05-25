const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const TAG = '[universal-serial-sdk]';

// ── Find project root ─────────────────────────────────────────────────────────
// Handles multiple install scenarios:
// 1. npm install (registry):     node_modules/universal-serial-sdk/scripts/ → 3 levels up
// 2. npm install <local path>:   npm sets INIT_CWD to where npm install was run
// 3. npm link:                   symlink, __dirname may point to original location
function findProjectRoot() {
    const candidates = [
        // Most reliable: npm sets INIT_CWD to the directory where npm install was run
        process.env.INIT_CWD,
        // Standard registry install: node_modules/pkg/scripts/ → 3 levels up
        path.resolve(__dirname, '../../..'),
        // Flattened or linked
        path.resolve(__dirname, '../..'),
        // Current working directory fallback
        process.cwd(),
    ].filter(Boolean); // remove undefined/null

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

// ── Android Gradle Patching (Capacitor/Cordova projects only) ─────────────────
if (!projectRoot) {
    console.log(`${TAG} No android/ folder found, skipping Gradle setup.`);
    console.log(`${TAG} ✅ JS SDK ready. Import from 'universal-serial-sdk'.`);
    process.exit(0);
}

console.log(`${TAG} Found project root: ${projectRoot}`);

// ── Also handle settings.gradle (newer AGP uses this instead of build.gradle) ─
const settingsGradle = path.join(projectRoot, 'android', 'settings.gradle');

// ── 1. Add JitPack ────────────────────────────────────────────────────────────
const jitpack = `        maven { url 'https://jitpack.io' }`;

// Try settings.gradle first (newer Capacitor projects)
if (fs.existsSync(settingsGradle)) {
    try {
        let content = fs.readFileSync(settingsGradle, 'utf8');
        if (content.includes('jitpack.io')) {
            console.log(`${TAG} JitPack already present in android/settings.gradle, skipped.`);
        } else {
            // Try dependencyResolutionManagement > repositories
            let patched = content.replace(
                /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/,
                `$1\n${jitpack}`
            );
            if (patched !== content) {
                fs.writeFileSync(settingsGradle, patched, 'utf8');
                console.log(`${TAG} ✅ Added JitPack to android/settings.gradle`);
            } else {
                console.warn(`${TAG} ⚠️  Could not auto-patch android/settings.gradle.`);
                console.warn(`${TAG}    Please add manually inside dependencyResolutionManagement > repositories:`);
                console.warn(`${TAG}    ${jitpack}`);
                anyFailed = true;
            }
        }
    } catch (e) {
        console.warn(`${TAG} ⚠️  Failed to patch android/settings.gradle: ${e.message}`);
        anyFailed = true;
    }
} else if (fs.existsSync(rootBuildGradle)) {
    // Fallback: try build.gradle (older projects)
    try {
        let content = fs.readFileSync(rootBuildGradle, 'utf8');
        if (content.includes('jitpack.io')) {
            console.log(`${TAG} JitPack already present in android/build.gradle, skipped.`);
        } else {
            const patched = content.replace(
                /(allprojects\s*\{[\s\S]*?repositories\s*\{)/,
                `$1\n${jitpack}`
            );
            if (patched !== content) {
                fs.writeFileSync(rootBuildGradle, patched, 'utf8');
                console.log(`${TAG} ✅ Added JitPack to android/build.gradle`);
            } else {
                console.warn(`${TAG} ⚠️  Could not auto-patch android/build.gradle.`);
                console.warn(`${TAG}    Please add manually inside allprojects > repositories:`);
                console.warn(`${TAG}    ${jitpack}`);
                anyFailed = true;
            }
        }
    } catch (e) {
        console.warn(`${TAG} ⚠️  Failed to patch android/build.gradle: ${e.message}`);
        anyFailed = true;
    }
} else {
    console.warn(`${TAG} ⚠️  Neither android/settings.gradle nor android/build.gradle found.`);
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
            if (patched !== content) {
                fs.writeFileSync(appBuildGradle, patched, 'utf8');
                console.log(`${TAG} ✅ Added Android-SerialPort-API to android/app/build.gradle`);
            } else {
                console.warn(`${TAG} ⚠️  Could not locate dependencies block in android/app/build.gradle.`);
                console.warn(`${TAG}    Please add manually inside dependencies {}:`);
                console.warn(`${TAG}    ${dep}`);
                anyFailed = true;
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
