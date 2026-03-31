import type { InstagramPost } from "@/lib/meta-api";

interface TopPostsProps {
  posts: InstagramPost[];
}

export function TopPosts({ posts }: TopPostsProps) {
  return (
    <section className="rounded-2xl border border-fuchsia-300/20 bg-card p-5">
      <h2 className="text-lg font-semibold text-white">Top 6 posts por engajamento</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 transition hover:border-fuchsia-300/50"
          >
            <div className="aspect-square w-full overflow-hidden bg-black/30">
              {post.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.mediaUrl}
                  alt="Post Instagram"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  Sem imagem
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-sm text-white">{post.caption}</p>
              <p className="mt-2 text-xs text-muted">
                Curtidas {post.likes} | Comentarios {post.comments}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
