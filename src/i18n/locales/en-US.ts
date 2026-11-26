export default {
  pages: {
    canvas: {
      title: "Canvas",
      noData: "No canvas data found.",
    },
  },
  components: {
    transcludes: {
      transcludeOf: ({ targetSlug }: { targetSlug: string }) => `Transclude of ${targetSlug}`,
      linkToOriginal: "Link to original",
    },
  },
};
