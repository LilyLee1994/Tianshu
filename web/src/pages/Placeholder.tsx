export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p className="muted">这一页还没接上真实数据，按开发计划排在后面几周。</p>
    </div>
  )
}
