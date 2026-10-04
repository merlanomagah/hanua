// The greeting on the wall, in many languages (Mel, 5 Oct 2026). It changes every 10 seconds; ", Mel." stays.
// Pacific languages first, then the rest. Where a language has a greeting for the time of day it's used;
// otherwise its everyday hello. No page imports here.

// The time of day, on the same hours as the lights (off at 9 pm, on at 4 am).
export function timeOfDay(hour) {
  if (hour >= 21 || hour < 4) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

const all = (word) => ({ morning: word, afternoon: word, evening: word, night: word });

export const GREETINGS = [
  { lang: "en", name: "English", morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good night" },
  { lang: "mi", name: "Te reo Māori", morning: "Mōrena", afternoon: "Kia ora", evening: "Ahiahi mārie", night: "Pō mārie" },
  { lang: "fj", name: "Fijian", morning: "Ni sa yadra", afternoon: "Ni sa bula", evening: "Ni sa bula", night: "Ni sa moce" },
  { lang: "sm", name: "Samoan", morning: "Manuia le taeao", afternoon: "Manuia le aoauli", evening: "Manuia le afiafi", night: "Manuia le pō" },
  { lang: "to", name: "Tongan", ...all("Mālō e lelei") },
  { lang: "hif", name: "Fiji Hindi", ...all("Namaste") },
  { lang: "fr", name: "French", morning: "Bonjour", afternoon: "Bonjour", evening: "Bonsoir", night: "Bonne nuit" },
  { lang: "es", name: "Spanish", morning: "Buenos días", afternoon: "Buenas tardes", evening: "Buenas noches", night: "Buenas noches" },
  { lang: "it", name: "Italian", morning: "Buongiorno", afternoon: "Buon pomeriggio", evening: "Buonasera", night: "Buonanotte" },
  { lang: "nl", name: "Dutch", morning: "Goedemorgen", afternoon: "Goedemiddag", evening: "Goedenavond", night: "Goedenacht" },
  { lang: "de", name: "German", morning: "Guten Morgen", afternoon: "Guten Tag", evening: "Guten Abend", night: "Gute Nacht" },
  { lang: "zh", name: "Chinese", morning: "早上好", afternoon: "下午好", evening: "晚上好", night: "晚安" },
  { lang: "ja", name: "Japanese", morning: "おはよう", afternoon: "こんにちは", evening: "こんばんは", night: "おやすみ" },
  { lang: "ko", name: "Korean", morning: "좋은 아침", afternoon: "안녕하세요", evening: "좋은 저녁", night: "안녕히 주무세요" },
];

export const GREET_NAME = "Mel";
export const GREET_EVERY_MS = 10_000;

// Every greeting for this hour, in order: [{ lang, name, text }]
export const greetingsAt = (hour) => {
  const when = timeOfDay(hour);
  return GREETINGS.map((g) => ({ lang: g.lang, name: g.name, text: g[when] }));
};
