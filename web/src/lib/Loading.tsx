// 全屏加载动画：延迟 150 毫秒才出现，加载很快时不会闪一下
export default function Loading({ text = '加载中' }: { text?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-box">
        <div className="loading-orbit"><i /><i /><i /><b>枢</b></div>
        <div className="loading-text">{text}<span className="loading-dots"><em>.</em><em>.</em><em>.</em></span></div>
      </div>
    </div>
  )
}
