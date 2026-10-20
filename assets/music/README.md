# Music beds

Drop licensed music files here (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`). When a format has `music.enabled: true`
and the project does not name a track (`music: path/to/file.mp3` in `brief.yaml`), the first file in this folder
is used. The renderer loops it, sets it ~24-26 dB under the voice, ducks it a further ~10 dB while the narrator
speaks, and fades it in and out.

Good sources: YouTube Audio Library, Pixabay Music, Epidemic Sound, Artlist. Look for low-tempo cinematic or
"documentary" beds with no vocals. Files in this folder are git-ignored so licensed music is never committed.
