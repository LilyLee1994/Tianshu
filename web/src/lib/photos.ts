import { supabase } from './supabase'

const BUCKET = 'work-photos'

// 压缩到最长边 1600px 的 JPEG，手机原图太大
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('图片处理失败'))), 'image/jpeg', 0.8))
}

// 上传一批照片到这张工单的目录，返回路径
export async function uploadPhotos(orderId: number | string, files: File[]): Promise<string[]> {
  const out: string[] = []
  for (const f of files) {
    const blob = await shrink(f)
    const path = `${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw new Error(`上传失败：${error.message}`)
    out.push(path)
  }
  return out
}

export async function signedUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return []
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]
}
