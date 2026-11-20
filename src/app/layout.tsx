import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "自然语言智能选股与策略解释器",
  description: "将模糊选股意图转为可检查、可修改、可执行的数据条件，并解释入选与排除依据。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
