import { defineConfig } from "@solidjs/start/config";
import { withSolidBase } from "@kobalte/solidbase/config";

export default defineConfig(
	withSolidBase(
		{
			ssr: true,
			server: {
				preset: "static",
				prerender: {
					crawlLinks: true,
					routes: [
						"/",
						"/tr",
						"/tr/guide",
						"/tr/guide/installation",
						"/tr/guide/ratings",
						"/tr/guide/watch-tracking",
					],
				},
			},
			vite: ({ router }:  { router: "server" | "client" | "server-function" }) => ({
				build:
					router === "client"
						? {
								target: "esnext",
								rollupOptions: {
									output: {
										manualChunks: {
											"solid-runtime": ["solid-js", "solid-js/web", "solid-js/store"],
											router: ["@solidjs/router"],
											kobalte: ["@kobalte/core"],
										},
									},
								},
							}
						: {},
			}),
		},
		{
			title: "AniScore",
			titleTemplate: "%s | AniScore",
			description:
				"See anime ratings, genres, and your watch progress directly on streaming sites. Powered by AniList.",
			logo: "/logo.svg",
			lang: "en",
			editPath:
				"https://github.com/seahindeniz/ani-score/edit/main/:path",
			lastUpdated: { dateStyle: "medium" },
			themeConfig: {
				fonts: {
					jetbrainsMono: false,
				},
				socialLinks: {
					github: "https://github.com/seahindeniz/ani-score",
				},
				nav: [
					{
						text: "Guide",
						link: "/guide",
					},
				],
				sidebar: {
					"/guide": [
						{
							title: "Getting Started",
							collapsed: false,
							items: [
								{
									title: "What is AniScore?",
									link: "/",
								},
								{
									title: "Installation",
									link: "/installation",
								},
							],
						},
						{
							title: "Features",
							collapsed: false,
							items: [
								{
									title: "Ratings & Details",
									link: "/ratings",
								},
								{
									title: "Watch Tracking",
									link: "/watch-tracking",
								},
							],
						},
					],
				},
			},
			locales: {
				tr: {
					label: "Türkçe",
					themeConfig: {
						nav: [
							{
								text: "Rehber",
								link: "/guide",
							},
						],
						sidebar: {
							"/guide": [
								{
									title: "Başlangıç",
									collapsed: false,
									items: [
										{
											title: "AniScore Nedir?",
											link: "/",
										},
										{
											title: "Kurulum",
											link: "/installation",
										},
									],
								},
								{
									title: "Özellikler",
									collapsed: false,
									items: [
										{
											title: "Puanlama ve Detaylar",
											link: "/ratings",
										},
										{
											title: "İzleme Takibi",
											link: "/watch-tracking",
										},
									],
								},
							],
						},
					},
				},
			},
		},
	),
);
