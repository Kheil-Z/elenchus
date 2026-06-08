"use client";

import { TypeAnimation } from "react-type-animation";

export function RollingWord() {
  return (
    <TypeAnimation
      sequence={[
        "conversations", 2200,
        "projects",       2200,
        "threads",        2200,
        "ideas",          2200,
      ]}
      wrapper="span"
      speed={55}
      deletionSpeed={70}
      repeat={Infinity}
      className="italic"
      cursor={true}
    />
  );
}
