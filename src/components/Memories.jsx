import React, { useEffect, useRef, useState } from 'react'
import { autocorrect } from '../lib/autocorrect.js'

// Growth journal. Memories are attachment ALBUMS (any file type, any size — kept
// on disk, never base64'd into the store). Folders nest anything. Right-click for
// Upload / New folder, or Delete on an item. Click a memory to edit it big.

function attsOf(m) {
  if (Array.isArray(m.atts) && m.atts.length) return m.atts
  const out = []
  for (const f of (m.files || [])) out.push({ kind: 'file', path: f.path, name: f.name, ext: f.ext, isImage: f.isImage })
  for (const d of (m.images || (m.image ? [m.image] : []))) out.push({ kind: 'data', dataUrl: d, isImage: true })
  return out
}
// Display straight from the file (browser rotates via EXIF). HEIC/TIFF use the
// sips-converted JPEG `display`. A video's chosen `thumb` (a dataURL) wins.
function imgSrc(a) { return a.thumb ? a.thumb : (a.kind === 'data' ? a.dataUrl : 'file://' + encodeURI(a.display || a.path)) }
function isVideo(a) { return ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', 'ogv'].includes((a.ext || '').toLowerCase()) }
function hasPreview(a) { return a.isImage || !!a.thumb }
// A viewable photo (opens in the full-screen lightbox). Anything image-like that
// isn't a video — so every picture opens, videos still play externally.
function isPic(a) { return !isVideo(a) && (a.isImage || !!a.thumb) }
function resizeDataUrl(dataUrl, max = 900) {
  return new Promise((res) => {
    const im = new Image()
    im.onload = () => { let w = im.width, h = im.height; if (Math.max(w, h) > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s) } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h); try { res(c.toDataURL('image/jpeg', 0.85)) } catch (e) { res(dataUrl) } }
    im.onerror = () => res(dataUrl)
    im.src = dataUrl
  })
}
function fileIcon(ext) {
  ext = (ext || '').toLowerCase()
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) return '🎬'
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(ext)) return '🎵'
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx', 'txt', 'rtf', 'pages', 'md'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return '📊'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️'
  return '📎'
}
async function pickAndImport(fileList) {
  const paths = Array.from(fileList || []).map((f) => window.kd.media.pathForFile(f)).filter(Boolean)
  if (!paths.length) return []
  try { return await window.kd.media.import(paths) } catch (e) { return [] }
}
function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }

export default function Memories({ onSetPhoto, onExit }) {
  const [items, setItems] = useState([])
  const [folder, setFolder] = useState(null)
  const [openMem, setOpenMem] = useState(null)
  const [ctx, setCtx] = useState(null)
  const [folderModal, setFolderModal] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importPct, setImportPct] = useState(0)
  const newFileRef = useRef(null)

  const load = async () => { try { setItems(await window.kd.memories.get()) } catch (e) {} }
  useEffect(() => { load() }, [])
  useEffect(() => { const close = () => setCtx(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [])
  useEffect(() => { const off = window.kd.media.onImportProgress((p) => { setImportPct(p.pct || 0); if (p.done) setTimeout(() => setImporting(false), 500) }); return off }, [])

  async function runImport(fileList) {
    const paths = Array.from(fileList || []).map((f) => window.kd.media.pathForFile(f)).filter(Boolean)
    if (!paths.length) return []
    setImporting(true); setImportPct(0)
    try { return await window.kd.media.import(paths) } finally { setTimeout(() => setImporting(false), 700) }
  }

  const inFolder = items.filter((i) => (i.parentId || null) === folder)
  const folders = inFolder.filter((i) => i.type === 'folder').sort((a, b) => b.at - a.at)
  const mems = inFolder.filter((i) => i.type !== 'folder').sort((a, b) => b.at - a.at)
  const path = (() => { const p = []; let cur = folder; while (cur) { const f = items.find((i) => i.id === cur); if (!f) break; p.unshift(f); cur = f.parentId || null } return p })()

  function goBack() {
    if (folder) { const cur = items.find((i) => i.id === folder); setFolder(cur?.parentId || null) }
    else if (onExit) onExit()
  }

  async function createFolder() {
    const name = folderName.trim() || 'New folder'
    try { const it = await window.kd.memories.add({ type: 'folder', name, parentId: folder }); setItems((l) => [...l, it]) } catch (e) {}
    setFolderModal(false); setFolderName('')
  }
  async function uploadNew(fileList) {
    const atts = await runImport(fileList)
    if (!atts.length) return
    try { const it = await window.kd.memories.add({ type: 'memory', atts, note: '', parentId: folder }); setItems((l) => [...l, it]); setOpenMem(it) } catch (e) {}
  }
  async function del(id) { try { await window.kd.memories.remove(id); setItems((l) => l.filter((m) => m.id !== id && m.parentId !== id)); if (openMem?.id === id) setOpenMem(null) } catch (e) {} }
  async function saveMem(id, patch) {
    try { await window.kd.memories.update({ id, ...patch }); setItems((l) => l.map((m) => m.id === id ? { ...m, ...patch } : m)); setOpenMem((o) => o && o.id === id ? { ...o, ...patch } : o) } catch (e) {}
  }

  return (
    <div className="view">
      {importing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, zIndex: 14000, background: 'rgba(245,208,96,0.12)' }}>
          <div style={{ height: '100%', width: importPct + '%', background: 'linear-gradient(90deg, var(--gold), var(--gold-2))', boxShadow: '0 0 12px var(--gold)', transition: 'width 0.2s ease' }} />
        </div>
      )}
      <div className="view-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <button onClick={goBack} title={folder ? 'Back' : 'Back to dashboard'} style={glassBack} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.94)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div>
            <h1>Your Growth</h1>
            <div className="sub" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span onClick={() => setFolder(null)} style={{ cursor: 'pointer', color: folder ? 'var(--gold)' : 'var(--muted)' }}>All memories</span>
              {path.map((f) => <span key={f.id} style={{ display: 'flex', gap: 6 }}>/ <span onClick={() => setFolder(f.id)} style={{ cursor: 'pointer', color: f.id === folder ? 'var(--text)' : 'var(--gold)' }}>{f.name}</span></span>)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setFolderModal(true)} style={ghostBtn}>+ New folder</button>
          <button onClick={() => newFileRef.current?.click()} style={goldBtn}>Upload</button>
        </div>
      </div>

      <div data-emptyzone="1" onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, item: null }) }} style={{ minHeight: '60vh', padding: 4 }}>
        {folders.length === 0 && mems.length === 0 && (
          <div data-emptyzone="1" style={{ color: 'var(--muted)', fontSize: 15, textAlign: 'center', padding: '60px 0' }}>Empty. Right-click anywhere to upload a file or make a folder.</div>
        )}
        {folders.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', marginBottom: mems.length ? 28 : 0 }}>
            {folders.map((f) => {
              const count = items.filter((i) => i.parentId === f.id).length
              return (
                <div key={f.id} onClick={(e) => { e.stopPropagation(); setFolder(f.id) }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, item: f }) }} style={{ width: 230, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg)', padding: '26px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: 84, lineHeight: 1 }}>📁</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 12, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{count} item{count === 1 ? '' : 's'}</div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {mems.map((m) => {
            const atts = attsOf(m)
            const cover = atts[0]
            const extra = Math.max(0, atts.length - 1)
            return (
              <div key={m.id} onClick={(e) => { e.stopPropagation(); setOpenMem(m) }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, item: m }) }} style={{ borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--bg)', cursor: 'pointer' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', background: 'var(--panel)' }}>
                  {cover && hasPreview(cover)
                    ? <img src={imgSrc(cover)} alt="memory" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: m.blur ? 'blur(22px)' : 'none', transform: m.blur ? 'scale(1.12)' : 'none' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: 8, padding: 12, textAlign: 'center' }}><span style={{ fontSize: 52 }}>{cover ? fileIcon(cover.ext) : '📝'}</span><span style={{ fontSize: 12, wordBreak: 'break-word' }}>{cover ? cover.name : 'note'}</span></div>}
                  {cover && isVideo(cover) && hasPreview(cover) && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>▶</div></div>}
                  {extra > 0 && <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 9px', borderRadius: 20 }}>+{extra}</div>}
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>{fmtDate(m.at)}</div>
                  {m.note && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 4, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', filter: m.blurText ? 'blur(5px)' : 'none', userSelect: m.blurText ? 'none' : 'auto' }}>{m.note}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <input ref={newFileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => { uploadNew(e.target.files); e.target.value = '' }} />

      {ctx && (
        <div style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 13000, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 20px 50px -15px rgba(0,0,0,0.7)' }}>
          {ctx.item ? (
            <>
              <div onClick={() => { const it = ctx.item; setCtx(null); it.type === 'folder' ? setFolder(it.id) : setOpenMem(it) }} style={ctxItem}>Open</div>
              <div onClick={() => { del(ctx.item.id); setCtx(null) }} style={{ ...ctxItem, color: 'var(--red)' }}>Delete</div>
            </>
          ) : (
            <>
              <div onClick={() => { setCtx(null); newFileRef.current?.click() }} style={ctxItem}>Upload</div>
              <div onClick={() => { setCtx(null); setFolderModal(true) }} style={ctxItem}>New folder</div>
            </>
          )}
        </div>
      )}

      {folderModal && (
        <Overlay onClose={() => setFolderModal(false)}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, color: 'var(--text)', marginBottom: 12 }}>New folder</div>
          <input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createFolder()} placeholder="Folder name (e.g. Money, Events, Wins)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => setFolderModal(false)} style={ghostBtn}>Cancel</button>
            <button onClick={createFolder} style={goldBtn}>Create</button>
          </div>
        </Overlay>
      )}

      {openMem && (
        <MemoryModal mem={openMem} onClose={() => setOpenMem(null)} onSave={saveMem} onDelete={() => del(openMem.id)} onSetPhoto={onSetPhoto} importFiles={runImport} />
      )}
    </div>
  )
}

function MemoryModal({ mem, onClose, onSave, onDelete, onSetPhoto, importFiles }) {
  const [note, setNote] = useState(mem.note || '')
  const [atts, setAtts] = useState(attsOf(mem))
  const [blur, setBlur] = useState(!!mem.blur)
  const [blurText, setBlurText] = useState(!!mem.blurText)
  const [show, setShow] = useState(false)
  const [lightbox, setLightbox] = useState(null)     // index into the viewable images
  const [lightSrc, setLightSrc] = useState(null)
  const [thumbCtx, setThumbCtx] = useState(null)     // {x,y,index} right-click on a video
  const [framePick, setFramePick] = useState(null)   // {index, src}
  const addRef = useRef(null)
  const thumbRef = useRef(null)
  const thumbTarget = useRef(null)
  useEffect(() => { const t = setTimeout(() => setShow(true), 20); return () => clearTimeout(t) }, [])
  useEffect(() => { const c = () => setThumbCtx(null); window.addEventListener('click', c); return () => window.removeEventListener('click', c) }, [])

  async function addFiles(fileList) { const more = await (importFiles ? importFiles(fileList) : pickAndImport(fileList)); if (more.length) setAtts((a) => [...a, ...more]) }
  const removeAtt = (i) => setAtts((a) => a.filter((_, k) => k !== i))
  const makeCover = (i) => setAtts((a) => { const c = [...a]; const [x] = c.splice(i, 1); c.unshift(x); return c })
  const setThumb = (i, dataUrl) => setAtts((a) => a.map((x, k) => k === i ? { ...x, thumb: dataUrl } : x))
  const save = () => { onSave(mem.id, { note: note.trim(), atts, blur, blurText }); onClose() }
  async function setProfile(a) {
    let url = a.thumb || (a.kind === 'data' ? a.dataUrl : null)
    if (!url) { try { url = await window.kd.media.readDataUrl(a.display || a.path) } catch (e) {} }
    if (url && onSetPhoto) onSetPhoto(url)
  }
  async function onDeviceThumb(fileList) {
    const f = (fileList || [])[0]; const i = thumbTarget.current; if (!f || i == null) return
    const raw = await new Promise((r) => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.onerror = () => r(null); rd.readAsDataURL(f) })
    if (raw) setThumb(i, await resizeDataUrl(raw))
  }
  const openAtt = (a) => {
    if (isPic(a)) { const view = atts.filter(isPic); const i = view.indexOf(a); setLightbox(i >= 0 ? i : 0) }
    else if (a.path) window.kd.media.open(a.path)
  }
  // Resolve the full-screen image robustly (read the actual bytes, so HEIC and
  // any file:// image always render, not just some).
  useEffect(() => {
    if (lightbox == null) { setLightSrc(null); return }
    const view = atts.filter(isPic)
    const cur = view[lightbox]
    if (!cur) { setLightSrc(null); return }
    if (cur.kind === 'data') { setLightSrc(cur.dataUrl); return }
    if (!cur.display && !cur.path && cur.thumb) { setLightSrc(cur.thumb); return }
    setLightSrc('file://' + encodeURI(cur.display || cur.path))
    let alive = true
    window.kd.media.readDataUrl(cur.display || cur.path).then((u) => { if (alive && u) setLightSrc(u) }).catch(() => {})
    return () => { alive = false }
  }, [lightbox, atts])
  // Keyboard: ← / → flip photos, Esc closes the full-screen viewer.
  useEffect(() => {
    if (lightbox == null) return
    const onKey = (e) => {
      const view = atts.filter(isPic); if (!view.length) return
      if (e.key === 'ArrowRight') { e.preventDefault(); setLightbox((i) => (view.length + i + 1) % view.length) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setLightbox((i) => (view.length + i - 1) % view.length) }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setLightbox(null) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [lightbox, atts])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 12500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: show ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)', backdropFilter: show ? 'blur(14px)' : 'blur(0px)', WebkitBackdropFilter: show ? 'blur(14px)' : 'blur(0px)', padding: 14, transition: 'background 0.35s ease, backdrop-filter 0.35s ease' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1400px, 97vw)', height: '94vh', display: 'flex', flexDirection: 'column', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, padding: 30, boxShadow: '0 40px 100px -20px rgba(0,0,0,0.85)', opacity: show ? 1 : 0, transform: show ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)', transition: 'transform 0.4s cubic-bezier(0.2,0.9,0.2,1), opacity 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, color: 'var(--text)' }}>Edit memory</div>
          <button onClick={onClose} style={{ background: 'var(--line)', border: 'none', color: 'var(--muted-2)', borderRadius: 9, padding: '7px 13px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 12, flexShrink: 0, maxHeight: '42vh', overflowY: 'auto' }}>
          {atts.map((a, i) => (
            <div key={i} onDoubleClick={() => openAtt(a)} onContextMenu={(e) => { if (isVideo(a)) { e.preventDefault(); e.stopPropagation(); setThumbCtx({ x: e.clientX, y: e.clientY, index: i }) } }} style={{ position: 'relative', aspectRatio: '9/16', borderRadius: 10, overflow: 'hidden', border: i === 0 ? '2px solid var(--gold)' : '1px solid var(--line)', cursor: 'pointer', background: 'var(--bg)' }}>
              {hasPreview(a)
                ? <img src={imgSrc(a)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, textAlign: 'center', color: 'var(--muted)' }}><span style={{ fontSize: 44 }}>{fileIcon(a.ext)}</span><span style={{ fontSize: 12, wordBreak: 'break-word' }}>{a.name}</span></div>}
              {isVideo(a) && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>▶</div></div>}
              {i === 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'var(--gold)', fontSize: 10, fontWeight: 800, textAlign: 'center', padding: '2px 0' }}>COVER</div>}
              <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                {i !== 0 && <button onClick={(e) => { e.stopPropagation(); makeCover(i) }} title="Set as cover" style={imgBtn}>★</button>}
                <button onClick={(e) => { e.stopPropagation(); removeAtt(i) }} title="Remove" style={imgBtn}>✕</button>
              </div>
            </div>
          ))}
          <div onClick={() => addRef.current?.click()} style={{ aspectRatio: '9/16', borderRadius: 10, border: '1px dashed var(--teal-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>+ Add files</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Any file, any size. Double-click a photo for full screen. Right-click a video to set its thumbnail.</div>
        <input ref={addRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { onDeviceThumb(e.target.files); e.target.value = '' }} />

        <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={(e) => setNote(autocorrect(e.target.value))} spellCheck={true} placeholder="What happened? What did you learn or win?" style={{ width: '100%', boxSizing: 'border-box', flex: 1, minHeight: 140, resize: 'none', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '15px 17px', color: 'var(--text)', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif', fontSize: 17, lineHeight: 1.55, outline: 'none' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <div onClick={() => setBlur((b) => !b)} style={toggleRow}>
            <Switch on={blur} />
            <div><div style={toggleTitle}>Blur cover</div><div style={toggleSub}>Keep the photo soft in the gallery, sharp when you open it</div></div>
          </div>
          <div onClick={() => setBlurText((b) => !b)} style={toggleRow}>
            <Switch on={blurText} />
            <div><div style={toggleTitle}>Blur text</div><div style={toggleSub}>Hide the note in the gallery, readable when you open it</div></div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onDelete} style={{ ...ghostBtn, color: 'var(--red)', borderColor: 'var(--red)' }}>Delete</button>
            {(atts[0]?.isImage || atts[0]?.thumb) && onSetPhoto && <button onClick={() => setProfile(atts[0])} style={ghostBtn}>Set as profile</button>}
          </div>
          <button onClick={save} style={goldBtn}>Save</button>
        </div>
      </div>

      {lightbox != null && (() => {
        const view = atts.filter(isPic)
        const cur = view[lightbox]
        if (!cur) return null
        const go = (d) => setLightbox((view.length + lightbox + d) % view.length)
        return (
          <div onClick={(e) => { e.stopPropagation(); setLightbox(null) }} style={{ position: 'fixed', inset: 0, zIndex: 13500, background: 'rgba(0,0,0,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            {view.length > 1 && <button onClick={(e) => { e.stopPropagation(); go(-1) }} style={navArrow('left')}>‹</button>}
            <img src={lightSrc || 'file://' + encodeURI(cur.display || cur.path || '')} alt="full" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '88vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
            {view.length > 1 && <button onClick={(e) => { e.stopPropagation(); go(1) }} style={navArrow('right')}>›</button>}
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {view.length > 1 && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700 }}>{lightbox + 1} / {view.length}</span>}
              <button onClick={(e) => { e.stopPropagation(); window.kd.media.download(cur) }} style={goldBtn}>⬇ Download</button>
              <button onClick={(e) => { e.stopPropagation(); setLightbox(null) }} style={{ ...ghostBtn, color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>Close</button>
            </div>
          </div>
        )
      })()}

      {thumbCtx && (
        <div style={{ position: 'fixed', left: thumbCtx.x, top: thumbCtx.y, zIndex: 13600, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 20px 50px -15px rgba(0,0,0,0.7)' }}>
          <div onClick={() => { const a = atts[thumbCtx.index]; setFramePick({ index: thumbCtx.index, src: 'file://' + encodeURI(a.path) }); setThumbCtx(null) }} style={ctxItem}>Pick a frame from the video</div>
          <div onClick={() => { thumbTarget.current = thumbCtx.index; setThumbCtx(null); thumbRef.current?.click() }} style={ctxItem}>Upload a thumbnail</div>
        </div>
      )}

      {framePick && (
        <FramePicker src={framePick.src} onClose={() => setFramePick(null)} onPick={(dataUrl) => { setThumb(framePick.index, dataUrl); setFramePick(null) }} />
      )}
    </div>
  )
}

function FramePicker({ src, onClose, onPick }) {
  const vref = useRef(null)
  const [err, setErr] = useState('')
  function capture() {
    const v = vref.current; if (!v || !v.videoWidth) return
    try {
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
      onPick(c.toDataURL('image/jpeg', 0.85))
    } catch (e) { setErr('Could not grab this frame. Use "Upload a thumbnail" instead.') }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 13700, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
      <video ref={vref} src={src} controls onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '74vh', borderRadius: 8, background: '#000' }} />
      <div onClick={(e) => e.stopPropagation()} style={{ color: 'var(--muted)', fontSize: 13 }}>Scrub to the moment you want, then grab it.</div>
      {err && <div onClick={(e) => e.stopPropagation()} style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <button onClick={capture} style={goldBtn}>Use this frame</button>
        <button onClick={onClose} style={{ ...ghostBtn, color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>Cancel</button>
      </div>
    </div>
  )
}

function Switch({ on }) {
  return (
    <div style={{ width: 50, height: 28, borderRadius: 20, flexShrink: 0, position: 'relative', background: on ? 'var(--gold)' : 'var(--line)', transition: 'background 0.3s ease' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.45)', transition: 'left 0.32s cubic-bezier(0.2,1.3,0.4,1)' }} />
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 13000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 94vw)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, padding: 24, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)' }}>{children}</div>
    </div>
  )
}

const ghostBtn = { background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }
const goldBtn = { background: 'var(--gold)', border: 'none', color: 'var(--on-gold)', borderRadius: 10, padding: '9px 18px', fontWeight: 800, cursor: 'pointer', fontSize: 13 }
const navArrow = (side) => ({ position: 'fixed', top: '50%', [side]: 'clamp(10px,3vw,40px)', transform: 'translateY(-50%)', width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 30, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, backdropFilter: 'blur(6px)', zIndex: 13600 })
const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none' }
const ctxItem = { padding: '10px 22px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }
const glassBack = {
  width: 74, height: 74, flexShrink: 0, borderRadius: 22, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03))',
  backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -2px 6px rgba(0,0,0,0.35), 0 12px 32px -8px rgba(0,0,0,0.6)',
  transition: 'transform 0.12s ease'
}
const toggleRow = { display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', userSelect: 'none' }
const toggleTitle = { fontSize: 14, fontWeight: 700, color: 'var(--text)' }
const toggleSub = { fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }
const imgBtn = { width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }
