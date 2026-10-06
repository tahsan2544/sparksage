<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Runtime image generation uses an authenticated TanStack server route that streams directly from Lovable AI Gateway; this keeps credentials private and supports progressive previews.
- Image prompts pass deterministic server-side safety checks before provider moderation; this blocks clearly unsafe requests early without weakening the upstream filter.
