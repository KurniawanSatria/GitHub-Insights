import { GitHubStats, ThemeColors } from "@/types/github";
import {
  icons,
  renderIcon,
  escapeHtml,
  formatNumber,
} from "./svg-utils";

interface CardOptions {
  theme: ThemeColors;
  showGraph?: boolean;
  showLanguages?: boolean;
  showStreak?: boolean;
  showStats?: boolean;
  showHeader?: boolean;
  showSummary?: boolean;
  showProfile?: boolean;
}

const FONT_FAMILY =
  "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const MONO_FONT =
  "ui-monospace, SFMono-Regular, SFMono, Menlo, Consolas, monospace";

const SECTION_GAP = 20;
const CARD_RADIUS = 6;
const OUTER_RADIUS = 8;

const ANIMATION_STYLE = `
  <style>
    .mi-name { animation: mi-nameIn 0.9s ease-out both; }
    .mi-underline { animation: mi-barX 0.9s ease-out 0.3s both; transform-box: fill-box; }
    .mi-underline-center { transform-origin: center; }
    .mi-underline-left { transform-origin: left center; }
    .mi-meta { animation: mi-fadeUp 0.9s ease-out 0.5s both; }
    .mi-card { animation: mi-fade 0.7s ease-out both; }
    .mi-d1 { animation-delay: 0.15s; }
    .mi-d2 { animation-delay: 0.25s; }
    .mi-d3 { animation-delay: 0.35s; }
    .mi-d4 { animation-delay: 0.45s; }
    .mi-chart { animation: mi-fade 1.1s ease-in-out 0.4s both; }
    .mi-bar { animation: mi-barX 1s ease-out 0.5s both; transform-box: fill-box; transform-origin: left center; }
    @keyframes mi-nameIn { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes mi-fadeUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes mi-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
    @keyframes mi-barX { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) {
      .mi-name, .mi-underline, .mi-meta, .mi-card, .mi-chart, .mi-bar { animation: none; }
    }
  </style>
`;

function getCardUid(stats: GitHubStats, theme: ThemeColors, options: CardOptions): string {
  const base = `${stats.user.login}|${theme.accent}|${theme.cardBackground}|${options.showGraph}|${options.showLanguages}|${options.showStreak}|${options.showStats}|${options.showHeader}|${options.showSummary}|${options.showProfile}`;
  let h1 = 0xdeadbeef;
  for (let i = 0; i < base.length; i++) {
    h1 = Math.imul(h1 ^ base.charCodeAt(i), 2654435761);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  return Math.abs(h1 >>> 0).toString(36).slice(0, 6);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + "…";
}

function truncateWords(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return base.trimEnd() + "…";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

function formatDateRange(startDateStr: string, endDateStr: string): string {
  if (!startDateStr || !endDateStr) return "";
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const startMonth = MONTHS_SHORT[startDate.getMonth()];
  const endMonth = MONTHS_SHORT[endDate.getMonth()];

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${endDate.getFullYear()}`;
  } else {
    return `${startMonth} ${startDate.getDate()}, ${startDate.getFullYear()} - ${endMonth} ${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
}

function formatDateFull(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getJoinedText(dateStr: string): string {
  if (!dateStr) return "";
  const created = new Date(dateStr);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - created.getTime());
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const years = Math.floor(diffDays / 365.25);

  if (years >= 1) {
    return `${years} year${years > 1 ? "s" : ""} ago`;
  }
  const months = Math.floor(diffDays / 30.44);
  if (months >= 1) {
    return `${months} month${months > 1 ? "s" : ""} ago`;
  }
  if (diffDays >= 1) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  return "recently";
}

function calculateGrade(stats: GitHubStats): { grade: string } {
  return { grade: stats.rank };
}

function renderHeaderSection(
  stats: GitHubStats,
  theme: ThemeColors,
  startY: number,
  cardWidth: number,
  options: {
    showProfile?: boolean;
    showSummary?: boolean;
    showHeader?: boolean;
  },
  uid: string
): { svg: string; height: number } {
  const { user, totalContributions, monthlyContributions } = stats;
  const rawName = user.name ? user.name.trim() : "";
  const rawLogin = user.login.trim();
  const hasDistinctName =
    rawName !== "" && rawName.toLowerCase() !== rawLogin.toLowerCase();

  const displayName = truncateWords(rawName || rawLogin, 28).toUpperCase();
  const name = escapeHtml(displayName);
  const fullName = escapeHtml(rawName || rawLogin);
  const login = escapeHtml(truncateText(rawLogin, 24));
  const fullLogin = escapeHtml(rawLogin);
  const rawLocation = user.location ? user.location.trim() : "";
  const location = rawLocation ? escapeHtml(truncateText(rawLocation, 30)) : "";
  const fullLocation = rawLocation ? escapeHtml(rawLocation) : "";

  const metaParts = [`@${rawLogin.toUpperCase()}`];
  if (rawLocation) metaParts.push(truncateWords(rawLocation, 28).toUpperCase());
  metaParts.push(`JOINED ${formatDateFull(stats.accountCreatedAt).toUpperCase()}`);
  const metaLine = escapeHtml(metaParts.join("   ·   "));

  const contributionPeriodLabel = "the last 12 months";

  const showProfile = options.showProfile !== false;
  const showSummary = options.showSummary !== false;
  const showHeader = options.showHeader !== false;

  if (!showProfile && !showSummary && !showHeader) {
    return { svg: "", height: 0 };
  }

  const monthlyData = monthlyContributions;

  const graphWidth = 280;
  const graphHeight = 90;
  let maxCount = 1;
  for (let i = 0; i < monthlyData.length; i++) {
    if (monthlyData[i].count > maxCount) {
      maxCount = monthlyData[i].count;
    }
  }

  const areaPoints: string[] = [`M 0 ${graphHeight}`];
  const linePoints: string[] = [];
  const dotCoords: { x: number; y: number }[] = [];

  monthlyData.forEach((data, i) => {
    const x = round1((i / Math.max(monthlyData.length - 1, 1)) * graphWidth);
    const y = round1(
      graphHeight - (data.count / maxCount) * (graphHeight - 15)
    );
    areaPoints.push(`L ${x} ${y}`);
    linePoints.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
    dotCoords.push({ x, y });
  });
  areaPoints.push(`L ${graphWidth} ${graphHeight} Z`);

  const areaPath = areaPoints.join(" ");
  const linePath = linePoints.join(" ");
  const headerGradientId = `headerArea-${uid}`;

  const dotsSvg = dotCoords
    .map((pt, idx) => {
      const isLast = idx === dotCoords.length - 1;
      const r = isLast ? 4.5 : 3;
      return `<circle cx="${pt.x}" cy="${pt.y}" r="${r}" fill="${theme.accent}" stroke="${theme.cardBackground}" stroke-width="1.5"/>`;
    })
    .join("");

  const profileSvg = showProfile
    ? `
      <g transform="translate(${cardWidth / 2}, 0)">
        <title>${fullName} (@${fullLogin})</title>
        <g opacity="0.6">
          <rect x="${-cardWidth / 2 + 40}" y="-22" width="22" height="2" fill="${
            theme.accent
          }"/>
          <rect x="${-cardWidth / 2 + 40}" y="-22" width="2" height="22" fill="${
            theme.accent
          }"/>
          <rect x="${cardWidth / 2 - 62}" y="-22" width="22" height="2" fill="${
            theme.accent
          }"/>
          <rect x="${cardWidth / 2 - 42}" y="-22" width="2" height="22" fill="${
            theme.accent
          }"/>
        </g>
        <text class="mi-name" x="0" y="0" text-anchor="middle" font-size="30" font-weight="800" fill="${
          theme.title
        }" font-family="${FONT_FAMILY}" letter-spacing="-0.5">
          ${hasDistinctName ? name : `@${login.toUpperCase()}`}
        </text>
        <rect class="mi-underline mi-underline-center" x="-160" y="14" width="320" height="2" rx="1" fill="${
          theme.accent
        }"/>
        <text class="mi-meta" x="0" y="44" text-anchor="middle" font-size="11" font-weight="400" fill="${
          theme.textSecondary
        }" font-family="${MONO_FONT}" letter-spacing="2">
          ${metaLine}
        </text>
      </g>
  `
    : "";

  const profileHeight = showProfile ? 64 : 0;
  const repoCount = user.repositories.totalCount;

  const summaryRows = showSummary
    ? [
        {
          icon: "fire",
          color: theme.iconColor,
          text: `${totalContributions.toLocaleString()} contribution${
            totalContributions === 1 ? "" : "s"
          } in ${contributionPeriodLabel}`,
          fullText: `${totalContributions.toLocaleString()} contributions in the last 12 months`,
        },
        {
          icon: "repo",
          color: theme.iconColor,
          text: `${repoCount.toLocaleString()} public ${
            repoCount === 1 ? "repository" : "repositories"
          }`,
          fullText: `${repoCount.toLocaleString()} public repositories`,
        },
        {
          icon: "calendar",
          color: theme.textSecondary,
          text: `Joined GitHub ${getJoinedText(stats.accountCreatedAt)}`,
          fullText: `Joined GitHub ${formatDateFull(stats.accountCreatedAt)}`,
        },
        ...(location
          ? [
              {
                icon: "pin",
                color: theme.iconColor,
                text: location,
                fullText: fullLocation,
              },
            ]
          : []),
      ]
    : [];

  const summaryHeight = showSummary ? summaryRows.length * 32 : 0;
  const headerChartHeight = showHeader ? 124 : 0;

  const showBothSummaryAndHeader = showSummary && showHeader;
  const summaryStartY = profileHeight + (showProfile ? 32 : 0);

  const summarySvg = showSummary
    ? `
      <g transform="translate(${showBothSummaryAndHeader ? 48 : (cardWidth - 320) / 2}, ${summaryStartY})">
        ${summaryRows
          .map(
            (row, index) => `
        <g transform="translate(0, ${index * 32})">
          <title>${row.fullText}</title>
          ${renderIcon(
            row.icon as "fire" | "repo" | "calendar" | "pin",
            0,
            -1,
            row.color,
            18
          )}
          <text x="28" y="13" font-size="14" font-weight="500" fill="${
            theme.text
          }" font-family="${FONT_FAMILY}" letter-spacing="0.2">
            ${row.text}
          </text>
        </g>
        `
          )
          .join("")}
      </g>
  `
    : "";

  const headerChartSvg = showHeader
    ? `
      <g transform="translate(${
        showBothSummaryAndHeader
          ? cardWidth - graphWidth - 80
          : (cardWidth - graphWidth) / 2
      }, ${summaryStartY})">
        <text x="${
          graphWidth / 2
        }" y="-8" text-anchor="middle" font-size="11" font-weight="400" fill="${
        theme.textSecondary
      }" font-family="${MONO_FONT}" letter-spacing="2">
          MONTHLY CONTRIBUTIONS
        </text>

        <line x1="0" y1="0" x2="${graphWidth}" y2="0" stroke="${
        theme.border
      }" stroke-width="1" stroke-dasharray="4,3" opacity="0.35"/>
        <line x1="0" y1="${graphHeight / 2}" x2="${graphWidth}" y2="${
        graphHeight / 2
      }" stroke="${
        theme.border
      }" stroke-width="1" stroke-dasharray="4,3" opacity="0.35"/>
        <line x1="0" y1="${graphHeight}" x2="${graphWidth}" y2="${graphHeight}" stroke="${
        theme.border
      }" stroke-width="1" opacity="0.6"/>
        
        <g transform="translate(${graphWidth + 10}, 0)">
          <text y="10" font-size="10" font-weight="500" fill="${
            theme.textSecondary
          }" font-family="${FONT_FAMILY}">${maxCount}</text>
          <text y="${graphHeight / 2 + 4}" font-size="10" font-weight="500" fill="${
        theme.textSecondary
      }" font-family="${FONT_FAMILY}">${Math.round(maxCount / 2)}</text>
          <text y="${graphHeight}" font-size="10" font-weight="500" fill="${
        theme.textSecondary
      }" font-family="${FONT_FAMILY}">0</text>
        </g>
        
        <defs>
          <linearGradient id="${headerGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${
              theme.accent
            };stop-opacity:0.28" />
            <stop offset="100%" style="stop-color:${
              theme.accent
            };stop-opacity:0.02" />
          </linearGradient>
        </defs>
        
        <path d="${areaPath}" fill="url(#${headerGradientId})" />
        <path class="mi-chart" d="${linePath}" fill="none" stroke="${
        theme.accent
      }" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dotsSvg}
        
        <g transform="translate(0, ${graphHeight + 16})">
          ${monthlyData
            .map((data, originalIdx) => {
              if (originalIdx % 4 !== 0 && originalIdx !== monthlyData.length - 1)
                return "";
              const x = round1(
                (originalIdx / Math.max(monthlyData.length - 1, 1)) * graphWidth
              );
              return `<text x="${x}" y="0" font-size="10" font-weight="500" fill="${
                theme.textSecondary
              }" font-family="${FONT_FAMILY}" text-anchor="middle">${
                data.label
              }</text>`;
            })
            .join("")}
        </g>
      </g>
  `
    : "";

  const contentHeight = showBothSummaryAndHeader
    ? Math.max(summaryHeight, headerChartHeight)
    : summaryHeight + headerChartHeight;

  const totalHeight =
    profileHeight + (showProfile ? 32 : 0) + contentHeight + 12;

  const svg = `
    <g transform="translate(0, ${startY})">
      ${profileSvg}
      ${summarySvg}
      ${headerChartSvg}
    </g>
  `;

  return { svg, height: totalHeight };
}

function renderStatsCard(
  stats: GitHubStats,
  theme: ThemeColors,
  startY: number,
  startX: number = 40
): { svg: string; height: number } {
  const { totalStars, totalContributions, totalPRs, totalIssues, contributedRepos } =
    stats;
  const { grade } = calculateGrade(stats);

  const statItems = [
    {
      icon: "star" as const,
      label: "Total Stars Earned",
      value: totalStars,
      color: theme.iconColor,
    },
    {
      icon: "commit" as const,
      label: "Contributions (12mo)",
      value: totalContributions,
      color: theme.iconColor,
    },
    {
      icon: "pr" as const,
      label: "Pull Requests (12mo)",
      value: totalPRs,
      color: theme.iconColor,
    },
    {
      icon: "issue" as const,
      label: "Issues (12mo)",
      value: totalIssues,
      color: theme.iconColor,
    },
    {
      icon: "fork" as const,
      label: "Contributed To (12mo)",
      value: contributedRepos,
      color: theme.iconColor,
    },
  ];

  const statsSvgParts = statItems.map((item, index) => {
    const y = index * 28;
    return `<g transform="translate(0, ${y})"><title>${item.label}: ${item.value.toLocaleString()}</title>${renderIcon(
      item.icon,
      0,
      0,
      item.color,
      16
    )}<text x="26" y="12" font-size="13" font-weight="500" fill="${
      theme.textSecondary
    }" font-family="${FONT_FAMILY}" letter-spacing="0.2">${
      item.label
    }</text><text x="252" y="12" font-size="14" font-weight="700" fill="${
      theme.text
    }" font-family="${FONT_FAMILY}" text-anchor="end" letter-spacing="0.1">${item.value.toLocaleString()}</text></g>`;
  });

  const svg = `<g class="mi-card mi-d1" transform="translate(${startX}, ${startY})">
      <rect x="0" y="0" width="377" height="204" rx="${CARD_RADIUS}" fill="${
        theme.cardBackground
      }" stroke="${theme.border}" stroke-width="1"/>
      <g transform="translate(24, 26)"><text x="0" y="0" font-size="18" font-weight="700" fill="${
    theme.title
  }" font-family="${FONT_FAMILY}" letter-spacing="-0.5">GitHub Stats.</text>
      <rect class="mi-underline mi-underline-left" x="0" y="8" width="72" height="2" rx="1" fill="${theme.accent}"/></g>
      <g transform="translate(24, 66)">${statsSvgParts.join("")}</g>
      <g transform="translate(290, 62)">
        <circle cx="36" cy="36" r="44" fill="${theme.accent}" opacity="0.06"/>
        <circle cx="36" cy="36" r="38" fill="${
          theme.background
        }" stroke="${theme.accent}" stroke-width="2"/>
        <circle cx="36" cy="36" r="30" fill="${theme.accent}" opacity="0.10"/>
        <text x="36" y="45" text-anchor="middle" font-size="26" font-weight="800" fill="${theme.text}" font-family="${FONT_FAMILY}" letter-spacing="-0.3">${grade}</text>
      </g>
      <g transform="translate(294, 150)">
        <rect x="0" y="0" width="64" height="22" rx="11" fill="${
          theme.background
        }" stroke="${theme.border}" stroke-width="1"/>
        <text x="32" y="15" text-anchor="middle" font-size="10" font-weight="400" fill="${
          theme.textSecondary
        }" font-family="${MONO_FONT}" letter-spacing="2">RANK</text>
      </g>
    </g>`;

  return { svg, height: 222 };
}

function renderLanguagesCard(
  stats: GitHubStats,
  theme: ThemeColors,
  startY: number,
  startX: number,
  uid: string
): { svg: string; height: number } {
  const { languages } = stats;

  if (languages.length === 0) {
    return { svg: "", height: 0 };
  }

  const barWidth = 329;
  const barHeight = 12;
  const borderRadius = 6;
  const clipId = `langBar-${uid}`;

  let currentX = 0;
  const segments: { x: number; width: number; color: string }[] = [];

  const topLangs = languages.slice(0, 8);
  const validLangs = topLangs.filter(
    (lang) => (lang.percentage / 100) * barWidth > 0.5
  );

  const totalPercentage = validLangs.reduce(
    (sum, lang) => sum + lang.percentage,
    0
  );

  for (let index = 0; index < validLangs.length; index++) {
    const lang = validLangs[index];
    const normalizedPercentage = (lang.percentage / totalPercentage) * 100;
    const width = (normalizedPercentage / 100) * barWidth;
    const actualWidth =
      index === validLangs.length - 1 ? barWidth - currentX : width;
    segments.push({
      x: round1(currentX),
      width: round1(actualWidth),
      color: lang.color,
    });
    currentX += actualWidth;
  }

  const segmentsSvg = segments
    .map(
      (seg) =>
        `<rect x="${seg.x}" y="0" width="${seg.width}" height="${barHeight}" fill="${seg.color}" stroke="${theme.cardBackground}" stroke-width="1.5"/>`
    )
    .join("");

  let leftLangsSvg = "";
  let rightLangsSvg = "";
  for (let i = 0; i < topLangs.length; i++) {
    const lang = topLangs[i];
    const colIndex = Math.floor(i / 2);
    const y = colIndex * 28;
    const fullLangName = lang.name;
    const shortName = truncateText(lang.name, 14);
    const escapedName = escapeHtml(shortName);
    const escapedFull = escapeHtml(fullLangName);
    const pct = lang.percentage.toFixed(1);
    if (i % 2 === 0) {
      leftLangsSvg += `<g transform="translate(0, ${y})"><title>${escapedFull} ${pct}%</title><circle cx="6" cy="7" r="5" fill="${
        lang.color
      }"/><text x="20" y="11" font-size="12" font-weight="600" fill="${
        theme.text
      }" font-family="${FONT_FAMILY}" letter-spacing="0.2">${escapedName}</text><text x="155" y="11" font-size="12" font-weight="500" fill="${
        theme.textSecondary
      }" font-family="${FONT_FAMILY}" text-anchor="end" letter-spacing="0.1">${pct}%</text></g>`;
    } else {
      rightLangsSvg += `<g transform="translate(175, ${y})"><title>${escapedFull} ${pct}%</title><circle cx="6" cy="7" r="5" fill="${
        lang.color
      }"/><text x="20" y="11" font-size="12" font-weight="600" fill="${
        theme.text
      }" font-family="${FONT_FAMILY}" letter-spacing="0.2">${escapedName}</text><text x="155" y="11" font-size="12" font-weight="500" fill="${
        theme.textSecondary
      }" font-family="${FONT_FAMILY}" text-anchor="end" letter-spacing="0.1">${pct}%</text></g>`;
    }
  }

  const svg = `<g class="mi-card mi-d2" transform="translate(${startX}, ${startY})">
      <rect x="0" y="0" width="377" height="204" rx="${CARD_RADIUS}" fill="${
        theme.cardBackground
      }" stroke="${theme.border}" stroke-width="1"/>
      <g transform="translate(24, 26)"><text x="0" y="0" font-size="18" font-weight="700" fill="${
    theme.title
  }" font-family="${FONT_FAMILY}" letter-spacing="-0.5">Most Used Languages.</text>
      <rect class="mi-underline mi-underline-left" x="0" y="8" width="72" height="2" rx="1" fill="${theme.accent}"/></g>
      <g transform="translate(24, 62)">
        <defs><clipPath id="${clipId}"><rect x="0" y="0" width="${barWidth}" height="${barHeight}" rx="${borderRadius}"/></clipPath></defs>
        <rect x="0" y="0" width="${barWidth}" height="${barHeight}" rx="${borderRadius}" fill="${
    theme.background
  }"/>
        <g class="mi-bar" clip-path="url(#${clipId})">${segmentsSvg}</g>
      </g>
      <g transform="translate(24, 92)">${leftLangsSvg}${rightLangsSvg}</g>
    </g>`;

  return { svg, height: 222 };
}

function renderStreakSection(
  stats: GitHubStats,
  theme: ThemeColors,
  startY: number,
  cardWidth: number
): { svg: string; height: number } {
  const {
    currentStreak,
    longestStreak,
    totalContributionsAllTime,
    accountCreatedAt,
  } = stats;

  const circleRadius = 32;
  const strokeWidth = 5;
  const innerCardWidth = cardWidth - 80;
  const cardWidth3 = round1((innerCardWidth - 32) / 3);
  const centerX = round1(cardWidth3 / 2);
  const progress = Math.min(currentStreak.count / 30, 1);
  const dashArray = round1(2 * Math.PI * circleRadius);
  const dashOffset = round1(2 * Math.PI * circleRadius * (1 - progress));

  const currentRange =
    currentStreak.startDate && currentStreak.count > 0
      ? formatDateRange(currentStreak.startDate, currentStreak.endDate)
      : "No active streak";
  const longestRange =
    longestStreak.count > 0 && longestStreak.startDate
      ? formatDateRange(longestStreak.startDate, longestStreak.endDate)
      : "No streak recorded";
  const joinedRange = `${formatDateFull(accountCreatedAt)} - Present`;

  const svg = `
    <g class="mi-card mi-d3" transform="translate(40, ${startY})">
      <g transform="translate(0, 0)">
        <title>Total contributions: ${totalContributionsAllTime.toLocaleString()}</title>
        <rect x="0" y="0" width="${cardWidth3}" height="144" rx="${CARD_RADIUS}" fill="${
    theme.cardBackground
  }" stroke="${theme.border}" stroke-width="1"/>
        
        <rect x="${round1(centerX - 18)}" y="14" width="36" height="36" rx="10" fill="${theme.accent}" opacity="0.12"/>
        <g transform="translate(${centerX}, 24)">
          ${renderIcon("contribution", -10, 0, theme.iconColor, 20)}
        </g>
        
        <text x="${
          centerX
        }" y="76" text-anchor="middle" font-size="26" font-weight="800" fill="${
    theme.text
  }" font-family="${FONT_FAMILY}" letter-spacing="-0.5">
          ${totalContributionsAllTime.toLocaleString()}
        </text>
        <text x="${
          centerX
        }" y="100" text-anchor="middle" font-size="10" font-weight="400" fill="${
    theme.textSecondary
  }" font-family="${MONO_FONT}" letter-spacing="2">
          TOTAL
        </text>
        <text x="${
          centerX
        }" y="121" text-anchor="middle" font-size="11" font-weight="500" fill="${
    theme.textSecondary
  }" font-family="${FONT_FAMILY}" opacity="0.9" letter-spacing="0.2">
          ${joinedRange}
        </text>
      </g>
      
      <g transform="translate(${round1(cardWidth3 + 16)}, 0)">
        <title>Current streak: ${currentStreak.count} days</title>
        <rect x="0" y="0" width="${cardWidth3}" height="144" rx="${CARD_RADIUS}" fill="${
    theme.cardBackground
  }" stroke="${theme.border}" stroke-width="1"/>
        
        <g transform="translate(${centerX}, 60)">
          <circle cx="0" cy="0" r="${circleRadius}" fill="none" stroke="${
    theme.border
  }" stroke-width="${strokeWidth}" opacity="0.35"/>
          <circle cx="0" cy="0" r="${circleRadius}" fill="none" stroke="${
    theme.accent
  }" stroke-width="${strokeWidth}" 
                  stroke-dasharray="${dashArray}" 
                  stroke-dashoffset="${dashOffset}"
                  transform="rotate(-90)"
                  stroke-linecap="round"/>
          <g transform="translate(-10, ${-circleRadius - 10})">
            ${renderIcon("fire", 0, 0, theme.iconColor, 20)}
          </g>
          <text x="0" y="8" text-anchor="middle" font-size="22" font-weight="800" fill="${
            theme.text
          }" font-family="${FONT_FAMILY}" letter-spacing="-0.3">
            ${currentStreak.count}
          </text>
        </g>
        
        <text x="${
          centerX
        }" y="112" text-anchor="middle" font-size="10" font-weight="400" fill="${
    theme.textSecondary
  }" font-family="${MONO_FONT}" letter-spacing="2">
          CURRENT STREAK
        </text>
        <text x="${
          centerX
        }" y="130" text-anchor="middle" font-size="11" font-weight="500" fill="${
    theme.textSecondary
  }" font-family="${FONT_FAMILY}" opacity="0.9" letter-spacing="0.2">
          ${currentRange}
        </text>
      </g>
      
      <g transform="translate(${round1((cardWidth3 + 16) * 2)}, 0)">
        <title>Longest streak: ${longestStreak.count} days</title>
        <rect x="0" y="0" width="${cardWidth3}" height="144" rx="${CARD_RADIUS}" fill="${
    theme.cardBackground
  }" stroke="${theme.border}" stroke-width="1"/>
        
        <rect x="${round1(centerX - 18)}" y="14" width="36" height="36" rx="10" fill="${theme.accent}" opacity="0.12"/>
        <g transform="translate(${centerX}, 24)">
          ${renderIcon("trophy", -10, 0, theme.iconColor, 20)}
        </g>
        
        <text x="${
          centerX
        }" y="76" text-anchor="middle" font-size="26" font-weight="800" fill="${
    theme.text
  }" font-family="${FONT_FAMILY}" letter-spacing="-0.5">
          ${longestStreak.count}
        </text>
        <text x="${
          centerX
        }" y="100" text-anchor="middle" font-size="10" font-weight="400" fill="${
    theme.textSecondary
  }" font-family="${MONO_FONT}" letter-spacing="2">
          LONGEST STREAK
        </text>
        <text x="${
          centerX
        }" y="121" text-anchor="middle" font-size="11" font-weight="500" fill="${
    theme.textSecondary
  }" font-family="${FONT_FAMILY}" opacity="0.9" letter-spacing="0.2">
          ${longestRange}
        </text>
      </g>
    </g>
  `;

  return { svg, height: 164 };
}

function renderContributionLineGraph(
  stats: GitHubStats,
  theme: ThemeColors,
  startY: number,
  cardWidth: number,
  uid: string
): { svg: string; height: number } {
  const { contributionData } = stats;

  if (!contributionData || contributionData.length === 0) {
    return { svg: "", height: 0 };
  }

  const last31Days = contributionData.slice(-31);

  const firstDate = new Date(last31Days[0].date);
  const lastDate = new Date(last31Days[last31Days.length - 1].date);

  let monthLabel: string;
  if (
    firstDate.getMonth() === lastDate.getMonth() &&
    firstDate.getFullYear() === lastDate.getFullYear()
  ) {
    monthLabel = `${MONTHS_LONG[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
  } else if (firstDate.getFullYear() === lastDate.getFullYear()) {
    monthLabel = `${MONTHS_SHORT[firstDate.getMonth()]} - ${
      MONTHS_SHORT[lastDate.getMonth()]
    } ${lastDate.getFullYear()}`;
  } else {
    monthLabel = `${MONTHS_SHORT[firstDate.getMonth()]} ${firstDate.getFullYear()} - ${
      MONTHS_SHORT[lastDate.getMonth()]
    } ${lastDate.getFullYear()}`;
  }

  const innerWidth = cardWidth - 80;
  const graphWidth = innerWidth - 70;
  const graphHeight = 80;
  const graphGradientId = `activityFill-${uid}`;
  let maxCount = 1;
  for (let i = 0; i < last31Days.length; i++) {
    if (last31Days[i].contributionCount > maxCount) {
      maxCount = last31Days[i].contributionCount;
    }
  }

  const linePathParts: string[] = [];
  let dataPointsSvg = "";
  let xAxisLabelsSvg = "";
  const lastIdx = last31Days.length - 1;
  const step = Math.max(lastIdx, 1);

  for (let i = 0; i < last31Days.length; i++) {
    const day = last31Days[i];
    const x = round1((i / step) * graphWidth);
    const y = round1(
      graphHeight - (day.contributionCount / maxCount) * (graphHeight - 10)
    );
    linePathParts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);

    if (i % 5 === 0 || i === lastIdx) {
      const isLast = i === lastIdx;
      dataPointsSvg += `<circle cx="${x}" cy="${y}" r="${
        isLast ? 5 : 3.5
      }" fill="${theme.accent}" stroke="${theme.cardBackground}" stroke-width="2"><title>${day.date}: ${day.contributionCount} contributions</title></circle>`;
    }

    if (i % 7 === 0 || i === lastIdx) {
      const date = new Date(day.date);
      xAxisLabelsSvg += `<text x="${x}" y="0" text-anchor="middle" font-size="10" font-weight="500" fill="${theme.textSecondary}" font-family="${FONT_FAMILY}" letter-spacing="0.2">${date.getDate()}</text>`;
    }
  }

  const linePath = linePathParts.join(" ");

  const svg = `<g class="mi-card mi-d4" transform="translate(40, ${startY})">
      <rect x="0" y="0" width="${innerWidth}" height="${
    graphHeight + 84
  }" rx="${CARD_RADIUS}" fill="${theme.cardBackground}" stroke="${
    theme.border
  }" stroke-width="1"/>
      <g transform="translate(24, 26)"><text x="0" y="0" font-size="18" font-weight="700" fill="${
    theme.title
  }" font-family="${FONT_FAMILY}" letter-spacing="-0.5">Contribution Activity.</text>
      <rect class="mi-underline mi-underline-left" x="0" y="8" width="72" height="2" rx="1" fill="${theme.accent}"/>
      <text x="0" y="30" font-size="10" font-weight="400" fill="${
    theme.textSecondary
  }" font-family="${MONO_FONT}" letter-spacing="2">DAILY · ${escapeHtml(monthLabel.toUpperCase())}</text></g>
      <g transform="translate(36, 70)">
        <text x="0" y="5" font-size="10" font-weight="500" fill="${
          theme.textSecondary
        }" text-anchor="end" font-family="${FONT_FAMILY}" letter-spacing="0.2">${maxCount}</text>
        <text x="0" y="${graphHeight / 2 + 2}" font-size="10" font-weight="500" fill="${
    theme.textSecondary
  }" text-anchor="end" font-family="${FONT_FAMILY}" letter-spacing="0.2">${Math.round(
    maxCount / 2
  )}</text>
        <text x="0" y="${graphHeight - 3}" font-size="10" font-weight="500" fill="${
    theme.textSecondary
  }" text-anchor="end" font-family="${FONT_FAMILY}" letter-spacing="0.2">0</text>
        <line x1="10" y1="0" x2="${graphWidth + 12}" y2="0" stroke="${
    theme.border
  }" stroke-width="1" stroke-dasharray="4,3" opacity="0.35"/>
        <line x1="10" y1="${graphHeight / 2}" x2="${graphWidth + 12}" y2="${
    graphHeight / 2
  }" stroke="${
    theme.border
  }" stroke-width="1" stroke-dasharray="4,3" opacity="0.35"/>
        <line x1="10" y1="${graphHeight}" x2="${
    graphWidth + 12
  }" y2="${graphHeight}" stroke="${theme.border}" stroke-width="1" opacity="0.6"/>
      </g>
      <g transform="translate(52, 70)">
        <defs><linearGradient id="${graphGradientId}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:${
          theme.accent
        };stop-opacity:0.25"/><stop offset="100%" style="stop-color:${
    theme.accent
  };stop-opacity:0.02"/></linearGradient></defs>
        <path d="${linePath} L ${graphWidth} ${graphHeight} L 0 ${graphHeight} Z" fill="url(#${graphGradientId})"/>
        <path class="mi-chart" d="${linePath}" fill="none" stroke="${
    theme.accent
  }" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dataPointsSvg}
      </g>
      <g transform="translate(52, ${graphHeight + 82})">${xAxisLabelsSvg}</g>
    </g>`;

  return { svg, height: graphHeight + 102 };
}

export function generateInsightCard(
  stats: GitHubStats,
  options: CardOptions
): string {
  const { theme } = options;
  const cardWidth = 850;
  const uid = getCardUid(stats, theme, options);
  let currentY = 44;

  const headerSection = renderHeaderSection(stats, theme, currentY, cardWidth, {
    showProfile: options.showProfile,
    showSummary: options.showSummary,
    showHeader: options.showHeader,
  }, uid);
  currentY += headerSection.height + (headerSection.height > 0 ? SECTION_GAP : 0);

  const showStats = options.showStats !== false;
  const showLanguages = options.showLanguages !== false;

  let statsStartX = 40;
  let languagesStartX = 433;

  if (showStats && !showLanguages) {
    statsStartX = (cardWidth - 377) / 2;
  } else if (!showStats && showLanguages) {
    languagesStartX = (cardWidth - 377) / 2;
  }

  const statsCard = showStats
    ? renderStatsCard(stats, theme, currentY, statsStartX)
    : { svg: "", height: 0 };

  const languagesCard = showLanguages
    ? renderLanguagesCard(stats, theme, currentY, languagesStartX, uid)
    : { svg: "", height: 0 };

  const statsAndLangsHeight = Math.max(statsCard.height, languagesCard.height);
  currentY += statsAndLangsHeight + (statsAndLangsHeight > 0 ? SECTION_GAP : 0);

  const streakSection =
    options.showStreak !== false
      ? renderStreakSection(stats, theme, currentY, cardWidth)
      : { svg: "", height: 0 };
  currentY += streakSection.height + (streakSection.height > 0 ? SECTION_GAP : 0);

  const graphSection =
    options.showGraph !== false
      ? renderContributionLineGraph(stats, theme, currentY, cardWidth, uid)
      : { svg: "", height: 0 };
  currentY += graphSection.height;

  const cardHeight = currentY + 32;
  const safeLogin = escapeHtml(stats.user.login);
  const summaryDesc = `${stats.totalContributions} contributions in the last year, ${stats.totalStars} stars, ${stats.currentStreak.count} day streak. Rank ${stats.rank}.`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub Insights for @${safeLogin}" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
  <title>GitHub Insights for @${safeLogin}</title>
  <desc>${escapeHtml(summaryDesc)}</desc>
  ${ANIMATION_STYLE}
  <rect x="0.5" y="0.5" width="${cardWidth - 1}" height="${
    cardHeight - 1
  }" rx="${OUTER_RADIUS}" fill="${theme.background}" stroke="${theme.border}" stroke-width="1"/>
  <g opacity="0.6">
    <rect x="20" y="20" width="22" height="2" fill="${theme.accent}"/>
    <rect x="20" y="20" width="2" height="22" fill="${theme.accent}"/>
    <rect x="${cardWidth - 42}" y="20" width="22" height="2" fill="${theme.accent}"/>
    <rect x="${cardWidth - 22}" y="20" width="2" height="22" fill="${theme.accent}"/>
  </g>
  
  ${headerSection.svg}
  ${statsCard.svg}
  ${languagesCard.svg}
  ${streakSection.svg}
  ${graphSection.svg}
</svg>
  `.trim();

  return svg;
}