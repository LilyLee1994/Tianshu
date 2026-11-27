import { useEffect } from 'react'

// 从总览点进来时：把页面里 id 为 `${prefix}${id}` 的那一行滚到屏幕中间（高亮靠 className="focus-row"）
export function useFocusScroll(prefix: string, id: number | null, dep: unknown) {
  useEffect(() => {
    if (!id) return
    const t = setTimeout(() => (document.querySelector(`[id^="${prefix}${id}"]`) as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
    return () => clearTimeout(t)
  }, [prefix, id, dep])
}
