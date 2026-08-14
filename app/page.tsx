import type { Metadata } from "next";
import { Hero } from "@/components/sections/hero";

export const metadata: Metadata = {
  title: "Seguro vehicular mensual | Confia",
  description:
    "Compara planes mensuales de seguro vehicular y encuentra una alternativa de protección acorde con tu auto y tus necesidades.",
};

export default function Home() {
  return <Hero />;
}
