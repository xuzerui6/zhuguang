package com.zhuguang.coachos;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getInstalledInfo(PluginCall call) {
        try {
            PackageInfo info = packageInfo(getContext().getPackageName());
            JSObject result = new JSObject();
            result.put("certificateSha256", signingCertificate(info));
            result.put("packageId", info.packageName);
            result.put("versionCode", longVersionCode(info));
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("无法读取当前安装信息", "INSTALLED_INFO_FAILED", error);
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url", "");
        String expectedSha256 = normalizeDigest(call.getString("sha256", ""));
        String expectedCertificate = normalizeDigest(call.getString("certificateSha256", ""));
        String expectedPackage = call.getString("packageId", "");
        int expectedVersionCode = call.getInt("versionCode", 0);
        if (url.isBlank() || expectedSha256.isBlank() || expectedCertificate.isBlank() || expectedPackage.isBlank() || expectedVersionCode < 1) {
            call.reject("更新清单不完整", "INVALID_RELEASE_MANIFEST");
            return;
        }
        if (!url.toLowerCase(Locale.ROOT).startsWith("https://")) {
            call.reject("更新安装包必须通过 HTTPS 下载", "INSECURE_UPDATE_URL");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("请先允许逐光安装未知应用", "INSTALL_PERMISSION_REQUIRED");
            return;
        }
        executor.execute(() -> performUpdate(call, url, expectedSha256, expectedCertificate, expectedPackage, expectedVersionCode));
    }

    private void performUpdate(
        PluginCall call,
        String sourceUrl,
        String expectedSha256,
        String expectedCertificate,
        String expectedPackage,
        int expectedVersionCode
    ) {
        HttpURLConnection connection = null;
        File target = null;
        try {
            File directory = new File(getContext().getCacheDir(), "updates");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("无法创建更新目录");
            target = new File(directory, "zhuguang-update-" + expectedVersionCode + ".apk");
            connection = (HttpURLConnection) new URL(sourceUrl).openConnection();
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
            connection.setRequestProperty("User-Agent", "Zhuguang-Android-Updater/1.1");
            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) throw new IllegalStateException("下载服务返回 HTTP " + responseCode);
            long totalBytes = connection.getContentLengthLong();
            if (totalBytes > 200L * 1024L * 1024L) throw new IllegalStateException("安装包大小超出安全限制");

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long downloaded = 0;
            int lastPercent = -1;
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(target, false)) {
                byte[] buffer = new byte[32 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    downloaded += count;
                    if (downloaded > 200L * 1024L * 1024L) throw new IllegalStateException("安装包大小超出安全限制");
                    output.write(buffer, 0, count);
                    digest.update(buffer, 0, count);
                    int percent = totalBytes > 0 ? (int) Math.min(100, downloaded * 100 / totalBytes) : 0;
                    if (percent != lastPercent) {
                        emitProgress("downloading", downloaded, totalBytes, percent, null);
                        lastPercent = percent;
                    }
                }
                output.getFD().sync();
            }
            String actualSha256 = hex(digest.digest());
            if (!actualSha256.equals(expectedSha256)) throw new SecurityException("APK SHA-256 校验失败");

            PackageInfo archive = getContext().getPackageManager().getPackageArchiveInfo(
                target.getAbsolutePath(),
                signingFlags()
            );
            if (archive == null) throw new SecurityException("无法读取 APK 包信息");
            if (!expectedPackage.equals(archive.packageName) || !getContext().getPackageName().equals(archive.packageName)) {
                throw new SecurityException("APK 包名与当前应用不一致");
            }
            long archiveVersionCode = longVersionCode(archive);
            long currentVersionCode = longVersionCode(packageInfo(getContext().getPackageName()));
            if (archiveVersionCode != expectedVersionCode || archiveVersionCode <= currentVersionCode) {
                throw new SecurityException("APK 版本号无效或不是升级版本");
            }
            String archiveCertificate = normalizeDigest(signingCertificate(archive));
            String currentCertificate = normalizeDigest(signingCertificate(packageInfo(getContext().getPackageName())));
            if (!archiveCertificate.equals(expectedCertificate) || !archiveCertificate.equals(currentCertificate)) {
                throw new SecurityException("APK 签名证书与当前应用不一致");
            }
            emitProgress("verified", downloaded, totalBytes > 0 ? totalBytes : downloaded, 100, null);
            launchInstaller(target);
            emitProgress("installing", downloaded, totalBytes > 0 ? totalBytes : downloaded, 100, null);
            JSObject result = new JSObject();
            result.put("launchedInstaller", true);
            call.resolve(result);
        } catch (Exception error) {
            if (target != null && target.exists()) target.delete();
            emitProgress("failed", 0, 0, 0, error.getMessage());
            call.reject(error.getMessage() == null ? "更新失败" : error.getMessage(), "UPDATE_VERIFICATION_FAILED", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void launchInstaller(File apk) {
        Uri contentUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(intent);
    }

    private void emitProgress(String state, long downloaded, long total, int percent, String message) {
        JSObject event = new JSObject();
        event.put("downloadedBytes", downloaded);
        event.put("totalBytes", total);
        event.put("percent", percent);
        event.put("state", state);
        if (message != null) event.put("message", message);
        notifyListeners("downloadProgress", event, true);
    }

    private PackageInfo packageInfo(String packageName) throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(
            packageName,
            signingFlags()
        );
    }

    private static int signingFlags() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    }

    private static long longVersionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    private static String signingCertificate(PackageInfo info) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null) {
            signatures = info.signingInfo.getApkContentsSigners();
        } else {
            signatures = info.signatures;
        }
        if (signatures == null || signatures.length == 0) throw new SecurityException("未找到 APK 签名证书");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(signatures[0].toByteArray());
        StringBuilder value = new StringBuilder();
        for (byte item : bytes) {
            if (value.length() > 0) value.append(':');
            value.append(String.format(Locale.ROOT, "%02X", item));
        }
        return value.toString();
    }

    private static String normalizeDigest(String value) {
        return value == null ? "" : value.replace(":", "").trim().toLowerCase(Locale.ROOT);
    }

    private static String hex(byte[] bytes) {
        StringBuilder value = new StringBuilder();
        for (byte item : bytes) value.append(String.format(Locale.ROOT, "%02x", item));
        return value.toString();
    }
}
