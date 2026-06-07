export function Flag({ url, name, size = 'md' }: { url?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'w-5 h-3.5', md: 'w-7 h-5', lg: 'w-10 h-7' }[size];
  if (!url) return <span className={`${dims} rounded-sm bg-gray-700 inline-block`} />;
  return (
    <img
      src={url}
      alt={name}
      className={`${dims} object-contain rounded-sm shadow-sm flex-shrink-0`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
