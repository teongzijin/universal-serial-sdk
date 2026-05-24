package com.universalserialsdk;

import android.serialport.SerialPort;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;

@CapacitorPlugin(name = "SerialPlugin")
public class SerialPlugin extends Plugin {

    private SerialPort mSerialPort;
    private OutputStream mOutputStream;
    private InputStream  mInputStream;
    private Thread mReadThread;
    private volatile boolean mReading = false;

    // Cordova keepCallback listener (null when used in Capacitor)
    private PluginCall mDataListenerCall = null;

    // ── Open Port ─────────────────────────────────────────────────────────────
    @PluginMethod
    public void openPort(PluginCall call) {
        String path   = call.getString("path", "/dev/ttyS4");
        int baudrate  = call.getInt("baudrate", 9600);
        java.io.File device = new java.io.File(path);

        // Mock fallback: device node does not exist (emulator / desktop testing)
        if (!device.exists()) {
            JSObject ret = new JSObject();
            ret.put("status", "mock_connected");
            ret.put("path", path);
            call.resolve(ret);
            return;
        }

        closeSerialPort();

        // Attempt privilege escalation on rooted devices if permission is denied
        if (!device.canRead() || !device.canWrite()) {
            try {
                Process su = Runtime.getRuntime().exec("/system/xbin/su");
                String cmd = "chmod 666 " + device.getAbsolutePath() + "\n" + "exit\n";
                su.getOutputStream().write(cmd.getBytes());
                su.getOutputStream().flush();
                su.waitFor();
            } catch (Exception ignored) {}
        }

        try {
            mSerialPort   = openSerialPortCompat(device, baudrate);
            mOutputStream = mSerialPort.getOutputStream();
            mInputStream  = mSerialPort.getInputStream();

            startReadThread();

            JSObject ret = new JSObject();
            ret.put("status", "connected");
            ret.put("path", path);
            call.resolve(ret);

        } catch (Throwable t) {
            call.reject("SerialSDK_Error: Failed to open port -> " + t.getMessage());
        }
    }

    // ── Send Hex ──────────────────────────────────────────────────────────────
    @PluginMethod
    public void sendHex(PluginCall call) {
        String hex = call.getString("hex");

        if (mOutputStream == null) {
            // Mock fallback
            if (!new java.io.File("/dev/ttyS4").exists()) {
                JSObject ret = new JSObject();
                ret.put("sent", hex);
                ret.put("status", "mock_sent");
                call.resolve(ret);
                return;
            }
            call.reject("SerialSDK_Error: Port is not open.");
            return;
        }

        try {
            byte[] data = hexToBytes(hex);
            mOutputStream.write(data);
            mOutputStream.flush();

            JSObject ret = new JSObject();
            ret.put("sent", hex);
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("SerialSDK_Error: Write failed -> " + e.getMessage());
        }
    }

    // ── Close Port ────────────────────────────────────────────────────────────
    @PluginMethod
    public void closePort(PluginCall call) {
        closeSerialPort();
        JSObject ret = new JSObject();
        ret.put("status", "closed");
        call.resolve(ret);
    }

    // ── Listen Data (Cordova keepCallback mode) ───────────────────────────────
    // Cordova uses keepCallback=true to receive multiple data events via one call
    // Capacitor uses notifyListeners() instead, so this method is Cordova-only
    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void listenData(PluginCall call) {
        call.setKeepAlive(true);
        mDataListenerCall = call;
    }

    // ── Read Thread ───────────────────────────────────────────────────────────
    private void startReadThread() {
        mReading = true;
        mReadThread = new Thread(() -> {
            byte[] buffer = new byte[64];
            while (mReading && !Thread.currentThread().isInterrupted()) {
                try {
                    if (mInputStream == null) break;
                    int len = mInputStream.read(buffer);
                    if (len > 0) {
                        StringBuilder sb = new StringBuilder();
                        for (int i = 0; i < len; i++) {
                            sb.append(String.format("%02X", buffer[i]));
                        }
                        String hex = sb.toString();

                        // Capacitor: push via notifyListeners
                        JSObject data = new JSObject();
                        data.put("hex", hex);
                        notifyListeners("onSerialData", data);

                        // Cordova: push via keepCallback call
                        if (mDataListenerCall != null) {
                            JSObject cordovaData = new JSObject();
                            cordovaData.put("hex", hex);
                            mDataListenerCall.resolve(cordovaData);
                        }
                    }
                } catch (IOException e) {
                    if (mReading) {
                        JSObject err = new JSObject();
                        err.put("error", e.getMessage());
                        notifyListeners("onSerialError", err);

                        if (mDataListenerCall != null) {
                            mDataListenerCall.reject("SerialSDK_Error: " + e.getMessage());
                            mDataListenerCall = null;
                        }
                    }
                    break;
                }
            }
        });
        mReadThread.setName("SerialSDK_ReadThread");
        mReadThread.start();
    }

    private void closeSerialPort() {
        mReading = false;
        mDataListenerCall = null;
        if (mReadThread != null && mReadThread.isAlive()) {
            mReadThread.interrupt();
        }
        try { if (mInputStream  != null) mInputStream.close();  } catch (IOException ignored) {}
        try { if (mOutputStream != null) mOutputStream.close(); } catch (IOException ignored) {}
        try { if (mSerialPort   != null) mSerialPort.close();   } catch (Exception ignored) {}
        mSerialPort   = null;
        mInputStream  = null;
        mOutputStream = null;
        mReadThread   = null;
    }

    // ── Compat: supports multiple versions of android-serialport-api ──────────
    private SerialPort openSerialPortCompat(java.io.File device, int baudrate) throws Exception {
        // Try newBuilder(File, int) - licheedev v2+
        try {
            Method newBuilder = SerialPort.class.getMethod("newBuilder", java.io.File.class, int.class);
            Object builder = newBuilder.invoke(null, device, baudrate);
            Method build = builder.getClass().getMethod("build");
            Object port = build.invoke(builder);
            if (port instanceof SerialPort) return (SerialPort) port;
        } catch (Throwable ignored) {}

        // Try newBuilder(String, int) - some variants
        try {
            Method newBuilder = SerialPort.class.getMethod("newBuilder", String.class, int.class);
            Object builder = newBuilder.invoke(null, device.getAbsolutePath(), baudrate);
            Method build = builder.getClass().getMethod("build");
            Object port = build.invoke(builder);
            if (port instanceof SerialPort) return (SerialPort) port;
        } catch (Throwable ignored) {}

        // Try constructor(File, int, int) - older versions
        try {
            Constructor<SerialPort> c = SerialPort.class.getConstructor(java.io.File.class, int.class, int.class);
            return c.newInstance(device, baudrate, 0);
        } catch (NoSuchMethodException ignored) {}

        // Fallback constructor(File, int)
        Constructor<SerialPort> c = SerialPort.class.getConstructor(java.io.File.class, int.class);
        return c.newInstance(device, baudrate);
    }

    // ── Hex Utility ───────────────────────────────────────────────────────────
    private byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            out[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                               +  Character.digit(hex.charAt(i + 1), 16));
        }
        return out;
    }
}
