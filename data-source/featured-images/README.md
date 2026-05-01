# Featured-work images

Drop images for the Featured Work showcase here. Filenames go into the
`image` field of each entry in `../featured-work.json`.

How to add a new featured job (the owner's workflow):

1. Drop the photo file into this folder. Any common format: `.jpg`,
   `.jpeg`, `.png`, `.webp`. Keep the file name simple — no spaces, e.g.
   `bonnet-scoop.jpg`.
2. Open `data-source/featured-work.json` in Notepad (or any text editor).
3. Copy one of the existing entries as a template. Change the `id` to
   something unique (e.g. `f005`, `f006`...). Set `title`, `description`,
   `fullStory`, `tag`, `year`, `category`, and `image` to match your new
   job. The `image` field is just the filename (no folder prefix).
4. Save the JSON file.
5. The next daily sync will pick up the new entry and copy the image to
   the website's public folder. To preview right away, run
   `npm run sync-data` from the `mmachine` folder.

> Files in this folder are gitignored — they don't go into the public
> repo. The sync script copies the ones referenced in the JSON into
> `public/featured/` (which IS tracked) so the website serves them.
