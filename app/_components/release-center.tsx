"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { platformBinaryRequest, platformRequest } from "./platform-client";
import { OperationDialog } from "./operation-dialog";
import { LoadingState } from "./async-states";
import styles from "./platform-pages.module.css";

type Release = { artifactPresent: boolean; forced: boolean; minimumSupportedVersionCode: number; rolloutPercentage: number; sizeBytes: number; status: "draft" | "paused" | "published"; versionCode: number; versionName: string };
type Receipt = { receiptId: string; objectKey: string; sha256: string; sizeBytes: number; versionCode: number; versionName: string };
type Command = { title: string; description: string; path: string; method: "POST" | "PATCH"; key: string; body: Record<string, unknown> };
const endpoint = "/api/v1/operator/releases";

export function ReleaseCenter() {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null); const [pending, setPending] = useState<Command | null>(null);
  const [policy, setPolicy] = useState<Release | null>(null);
  const loadGeneration = useRef(0);
  const uploadController = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const result = await platformRequest<Release[]>(endpoint);
    if (generation !== loadGeneration.current) return;
    setReleases(result); setCode(String(Math.max(0, ...result.map((release) => release.versionCode)) + 1));
  }, []);
  useEffect(() => {
    let active = true;
    void load().catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; loadGeneration.current += 1; uploadController.current?.abort(); };
  }, [load]);
  function act(release: Release, action: "publish" | "pause" | "notify") {
    setPending({ title: `${action === "publish" ? "发布" : action === "pause" ? "暂停" : "发送版本通知"} ${release.versionName}`, description: action === "notify" ? "将向符合通知设置的账号创建一次版本提醒。重复提交不会重复排队。" : `作用于 code ${release.versionCode}；${action === "pause" ? "停止新下载，不影响已安装用户。" : `按 ${release.rolloutPercentage}% 灰度开放更新。`}`, path: `${endpoint}/${release.versionCode}/${action}`, method: "POST", key: crypto.randomUUID(), body: {} });
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); const artifact = form.get("artifact");
    if (!(artifact instanceof File) || !artifact.size || artifact.size > 20 * 1024 * 1024) { setError("请选择不超过20MB的正式签名 APK"); return; }
    const controller = new AbortController();
    uploadController.current?.abort(); uploadController.current = controller;
    setBusy(true); setError(""); setReceipt(null);
    try {
      const uploaded = await platformBinaryRequest<Receipt>(`${endpoint}/${code}/artifact`, artifact, {
        headers: { "x-release-version-name": name }, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setReceipt(uploaded);
      setPending({ title: `创建 ${uploaded.versionName} 发布清单`, description: `包名 com.zhuguang.coachos，code ${uploaded.versionCode}，${(uploaded.sizeBytes / 1048576).toFixed(2)}MB。SHA-256：${uploaded.sha256}`, path: endpoint, method: "POST", key: crypto.randomUUID(), body: { receiptId: uploaded.receiptId, certificateSha256: form.get("certificate"), forced: false, minimumSupportedVersionCode: Number(form.get("minimum")), rolloutPercentage: Number(form.get("rollout")), notes: String(form.get("notes")).split("\n").map((line) => line.trim()).filter(Boolean) } });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "上传失败");
    } finally {
      if (uploadController.current === controller) uploadController.current = null;
      setBusy(false);
    }
  }
  function cancelUpload() { uploadController.current?.abort(); setError("上传已取消，可以重新选择安装包继续。"); }
  return <div className={styles.page}><header className={styles.heading}><div><h1>Android 版本发布</h1><p>先上传签名安装包，核对服务端回执后创建发布清单。</p></div></header>
    {error ? <div className={styles.error} role="alert"><p>{error}</p><button className={styles.secondary} onClick={() => void load().then(() => setError("")).catch((failure: Error) => setError(failure.message))}>重新加载</button></div> : null}
    <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><h2>版本记录</h2></header>
      {releases === null ? <LoadingState label="读取版本记录" variant="table" /> : !releases.length ? <p className={styles.empty}>暂无发布记录</p> : <div className={styles.list}>{releases.map((release) => <article className={styles.listItem} key={release.versionCode}><div><h3>{release.versionName} · code {release.versionCode}</h3><p>{release.status === "published" ? `已发布 ${release.rolloutPercentage}%` : release.status === "paused" ? "已暂停" : "草稿"} · {(release.sizeBytes / 1048576).toFixed(1)}MB</p></div><div className={styles.rowActions}><button className={styles.secondary} onClick={() => setPolicy(release)}>策略</button>{release.status !== "published" ? <button className={styles.primary} disabled={!release.artifactPresent} onClick={() => act(release, "publish")}>发布</button> : <><button className={styles.secondary} onClick={() => act(release, "notify")}>通知</button><button className={styles.danger} onClick={() => act(release, "pause")}>暂停</button></>}</div></article>)}</div>}
    </section><section className={styles.panel}><header className={styles.panelHeader}><h2>上传新版本</h2></header><form className={styles.form} onSubmit={upload}>
      <div className={styles.formGrid}><label className={styles.field}><span>版本名称</span><input onChange={(event) => { setName(event.target.value); setReceipt(null); }} pattern="\d+\.\d+\.\d+" required value={name} /></label><label className={styles.field}><span>versionCode</span><input min={1} onChange={(event) => { setCode(event.target.value); setReceipt(null); }} required type="number" value={code} /></label><label className={styles.field}><span>最低支持 code</span><input defaultValue={5} min={1} name="minimum" required type="number" /></label><label className={styles.field}><span>初始灰度</span><select defaultValue="10" name="rollout"><option value="0">仅指定设备</option><option value="10">10%</option><option value="50">50%</option><option value="100">100%</option></select></label></div>
      <label className={styles.field}><span>签名证书 SHA-256</span><input name="certificate" required /></label><label className={styles.field}><span>更新说明</span><textarea name="notes" required /></label><label className={styles.field}><span>正式签名 APK（上限20MB）</span><input accept=".apk,application/vnd.android.package-archive" name="artifact" required type="file" /></label><div className={styles.rowActions}><button className={styles.primary} disabled={busy || releases === null} type="submit">{busy ? "正在上传" : "上传并核对清单"}</button>{busy ? <button className={styles.secondary} onClick={cancelUpload} type="button">取消上传</button> : null}</div>
      {receipt ? <p role="status">已收到 code {receipt.versionCode} 上传回执；安装包摘要由服务端计算。</p> : null}
    </form></section></div>
    {policy ? <section className={styles.panel}><form className={styles.form} key={policy.versionCode} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setPending({ title: `调整 ${policy.versionName} 发布策略`, description: "策略变更影响后续更新检测，不影响已安装数据。", path: `${endpoint}/${policy.versionCode}/policy`, method: "PATCH", key: crypto.randomUUID(), body: { rolloutPercentage: Number(form.get("rollout")), minimumSupportedVersionCode: Number(form.get("minimum")), forced: form.get("forced") === "on" } }); }}><h2>发布策略 · {policy.versionName}</h2><label className={styles.field}>灰度百分比<input defaultValue={policy.rolloutPercentage} max={100} min={0} name="rollout" required type="number" /></label><label className={styles.field}>最低支持 code<input defaultValue={policy.minimumSupportedVersionCode} max={policy.versionCode} min={1} name="minimum" required type="number" /></label><label><input defaultChecked={policy.forced} name="forced" type="checkbox" />强制更新</label><div className={styles.rowActions}><button className={styles.secondary} onClick={() => setPolicy(null)} type="button">取消</button><button className={styles.primary} type="submit">核对修改</button></div></form></section> : null}
    {pending ? <OperationDialog description={pending.description} onCancel={() => setPending(null)} onConfirm={async (reason) => { await platformRequest(pending.path, { method: pending.method, idempotencyKey: pending.key, body: { ...pending.body, confirmed: true, reason } }); setPending(null); setPolicy(null); setNotice("操作完成，已写入审计记录"); await load(); }} title={pending.title} /> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </div>;
}
