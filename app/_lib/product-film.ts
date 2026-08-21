export type ProductFilmManifest = {
  id: string;
  title: string;
  durationSeconds: number;
  width: number;
  height: number;
  poster: string;
  captions: string;
  sources: Array<{ src: string; type: string }>;
  version: string;
};

export const productFilm: ProductFilmManifest = {
  id: "zhuguang-service-story",
  title: "从训练目标到每一次进步",
  durationSeconds: 24,
  width: 1920,
  height: 1080,
  poster: "/media/zhuguang-product-film-poster.webp",
  captions: "/media/zhuguang-product-film.vtt",
  sources: [
    { src: "/media/zhuguang-product-film.webm", type: "video/webm" },
    { src: "/media/zhuguang-product-film.mp4", type: "video/mp4" },
  ],
  version: "2026.08.1",
};
