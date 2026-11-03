"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "@iconify/react";
import whatsappLogo from "@iconify/icons-ion/logo-whatsapp";
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ExternalLinkIcon,
  EyeOpenIcon,
  ImageIcon as PhotoIcon,
  InstagramLogoIcon,
  ReloadIcon,
  ChatBubbleIcon,
  PauseIcon,
  PlayIcon,
  PaperPlaneIcon,
  GearIcon,
  BarChartIcon,
  ClockIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  MinusIcon,
  Cross2Icon,
  RowsIcon,
  ResetIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  LayersIcon,
  CheckCircledIcon,
  BookmarkIcon,
  TokensIcon,
  PersonIcon,
  TrashIcon,
} from "@radix-ui/react-icons";

type Props = ComponentPropsWithoutRef<typeof CalendarIcon> & { size?: number };
type WhatsAppProps = Omit<
  ComponentPropsWithoutRef<typeof Icon>,
  "icon" | "mode"
> & {
  size?: number;
};
function icon(Component: typeof CalendarIcon) {
  return function MarketingIcon({ size = 18, ...props }: Props) {
    return (
      <Component
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        {...props}
      />
    );
  };
}
export const CalendarClock = icon(CalendarIcon);
export const Today = icon(ResetIcon);
export const Check = icon(CheckIcon);
export const ChevronLeft = icon(ChevronLeftIcon);
export const ChevronRight = icon(ChevronRightIcon);
export const CircleAlert = icon(ExclamationTriangleIcon);
export const ExternalLink = icon(ExternalLinkIcon);
export const Eye = icon(EyeOpenIcon);
export const ImageIcon = icon(PhotoIcon);
export const Instagram = icon(InstagramLogoIcon);
export const Loader2 = icon(ReloadIcon);
export const RefreshCw = icon(ReloadIcon);
export const MessageCircle = icon(ChatBubbleIcon);
// Bundle the installed Ionicons brand asset so the logo needs no runtime fetch.
export function WhatsApp({ size = 18, ...props }: WhatsAppProps) {
  return (
    <Icon
      icon={whatsappLogo}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...props}
      mode="svg"
    />
  );
}
export const Pause = icon(PauseIcon);
export const Play = icon(PlayIcon);
export const Send = icon(PaperPlaneIcon);
export const Settings2 = icon(GearIcon);
export const Chart = icon(BarChartIcon);
export const Clock = icon(ClockIcon);
export const ArrowRight = icon(ArrowRightIcon);
export const Trash = icon(TrashIcon);
export const Plus = icon(PlusIcon);
export const Minus = icon(MinusIcon);
export const Close = icon(Cross2Icon);
export const Rows = icon(RowsIcon);
export const Heart = icon(HeartIcon);
export const Search = icon(MagnifyingGlassIcon);
export const Layers = icon(LayersIcon);
export const CheckCircle = icon(CheckCircledIcon);
export const Bookmark = icon(BookmarkIcon);

export const ArrowUp = icon(ArrowUpIcon);
export const ArrowDown = icon(ArrowDownIcon);

export const Coins = icon(TokensIcon);
export const Person = icon(PersonIcon);
