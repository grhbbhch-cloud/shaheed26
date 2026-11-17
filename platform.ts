export type GradientDirection =
  | 'to left'
  | 'to right'
  | 'to top'
  | 'to bottom'
  | 'to top left'
  | 'to top right'
  | 'to bottom left'
  | 'to bottom right';

export interface GradientConfig {
  enabled: boolean;
  type: 'linear' | 'radial' | 'conic';
  angle: number;
  direction: GradientDirection;
  position: string;
  stops: string[];
  opacity: number;
  intensity: number;
  animated: boolean;
  animationSpeed: number; // seconds
  animationDirection: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  timingFunction?: 'ease' | 'ease-in-out' | 'linear';
  transitionSpeedMs?: number;
  spreadPercent?: number;
  loop: boolean;
  animationPaused?: boolean;
}

export interface TextStyleConfig {
  fontFamily: string;
  fontSizeDesktop: string;
  fontSizeTablet: string;
  fontSizeMobile: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: 'right' | 'center' | 'left' | 'justify';
  textDecoration: 'none' | 'underline' | 'line-through';
  color: string;
  opacity: number;
  textShadow: string;
  gradient: GradientConfig;
  disableTargetGradient?: boolean;
  hoverColor?: string;
}

export interface DecorationRegionConfig {
  enabled: boolean;
  pattern:
    | 'none'
    | 'islamic-star'
    | 'diamond-strip'
    | 'geometric-grid'
    | 'interlocking-octagons'
    | 'arabesque-mesh'
    | 'custom-svg';
  customSvgUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  opacity: number;
  size: number; // px
  rotation: number; // deg
  spacing: number; // px
  density: number; // 1..3
  position: 'center' | 'top' | 'bottom' | 'repeat';
  blendMode: string;
  animation: 'none' | 'drift' | 'pulse' | 'rotate';
  animationSpeed: number; // seconds
  lineThickness: number;
  borderStyle: string;
}

export interface BackgroundLayer {
  id: string;
  type: 'solid' | 'gradient' | 'animated-gradient' | 'image' | 'video' | 'pattern';
  visible: boolean;
  color?: string;
  gradient?: GradientConfig;
  mediaUrl?: string;
  patternType?: DecorationRegionConfig['pattern'];
  patternColor?: string;
  opacity: number;
  blur: number;
  position: string;
  size: string;
  repeat: string;
  attachment: 'scroll' | 'fixed';
  blendMode: string;
  animation?: 'none' | 'pan' | 'zoom' | 'pulse';
  animationSpeed?: number;
}

export interface BackgroundRegionConfig {
  layers: BackgroundLayer[];
  mobileImageUrl?: string;
  mobileColor?: string;
}

export interface AnimatedWordConfig {
  text: string;
  color: string;
  fontSize: number;
  fontWeight?: string;
}

export interface LoadingStyleConfig {
  enabled: boolean;
  style:
    | 'spinner'
    | 'rotating-icon'
    | 'animated-lines'
    | 'pulsing-circles'
    | 'custom-svg'
    | 'icon-loader'
    | 'animated-words';
  iconName: string;
  customSvg: string;
  words?: AnimatedWordConfig[];
  wordGap?: number;
  shape: 'circle' | 'rounded' | 'square';
  size: number;
  color: string;
  secondaryColor: string;
  useGradient: boolean;
  speed: number; // seconds
  rotation: boolean;
  direction: 'clockwise' | 'counterclockwise';
  shadow: string;
  glow: string;
  opacity: number;
  background: string;
  position: 'center' | 'top-right' | 'top-left' | 'inline';
}

export interface NavItemConfig {
  id: string;
  label: string;
  url: string;
  type: 'internal' | 'external' | 'page';
  pageId?: number | null;
  icon: string;
  visible: boolean;
  order: number;
  openInNewTab: boolean;
  children: NavItemConfig[];
}

export interface ButtonConfig {
  id: string;
  label: string;
  icon: string;
  customIconUrl: string;
  iconSize: number;
  iconColor: string;
  textColor: string;
  background: string;
  gradient: GradientConfig;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  styleMode:
    | 'solid'
    | 'outline'
    | 'transparent'
    | 'gradient'
    | 'animated-gradient'
    | 'icon-only'
    | 'text-only'
    | 'icon-with-text';
  hoverEffect:
    | 'none'
    | 'lift'
    | 'shine'
    | 'glow'
    | 'shadow'
    | 'scale'
    | 'icon-move'
    | 'animated-border'
    | 'color-transition';
  hoverBg: string;
  hoverText: string;
  shadow: string;
  glow: string;
  paddingX: number;
  paddingY: number;
  width: string;
  height: string;
  action: 'url' | 'download' | 'share' | 'copy' | 'scroll';
  destination: string;
  openInNewTab: boolean;
  placement: 'global' | 'hero' | 'video' | 'image' | 'article' | 'header' | 'footer';
  visible: boolean;
  disabled: boolean;
  order: number;
}

export interface InfoCardFieldConfig {
  key: string;
  label: string;
  visible: boolean;
  deleted: boolean;
  order: number;
  customValue?: string;
  icon?: string;
  iconColor?: string;
  fontFamily: string;
  fontSize: string;
  fontWeight?: string;
  color: string;
  background: string;
  textAlign: 'right' | 'center' | 'left';
  spacing: number;
}

export interface InfoCardConfig {
  enabled: boolean;
  deleted?: boolean;
  layout?: 'vertical' | 'two-column' | 'horizontal';
  boxTitle?: string;
  showBoxTitle?: boolean;
  background: string;
  gradient: GradientConfig;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: string;
  glow: string;
  width: string;
  height: string;
  position: 'left' | 'right' | 'below';
  padding: number;
  spacing: number;
  separatorColor: string;
  hoverEffect: 'none' | 'lift' | 'glow';
  maxFields?: number;
  mobilePosition?: 'below' | 'above' | 'hidden';
  textAlign?: 'right' | 'center' | 'left';
  fields: InfoCardFieldConfig[];
}

export interface RelatedSettingsConfig {
  enabled: boolean;
  deleted?: boolean;
  title: string;
  description: string;
  position: 'below' | 'sidebar';
  maxItems: number;
  contentTypes: string[];
  sourcePageIds: number[];
  sourceChildPageIds: number[];
  selectionMode: 'newest' | 'oldest' | 'category' | 'tags' | 'manual';
  manualIds: number[];
  filterCategory: string;
  filterTags: string[];
  excludeCurrent: boolean;
  excludeHidden: boolean;
  excludeArchived: boolean;
  cardDesign: {
    showThumbnail: boolean;
    showTitle: boolean;
    showDescription: boolean;
    showDate: boolean;
    showViews: boolean;
    showBadge: boolean;
    showIcon: boolean;
    showPlayButton: boolean;
    cardBackground: string;
    textColor: string;
    metaColor?: string;
    titleFontSize?: string;
    titleGradient: GradientConfig;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    shadow: string;
    glow: string;
    hoverEffect: 'none' | 'lift' | 'zoom' | 'glow';
    spacing: number;
    cardPadding?: number;
    imageAspectRatio?: '16/9' | '4/3' | '1/1' | 'auto';
    imageHeight?: string;
    layout: 'grid' | 'list';
    columns: number;
    columnsMobile?: number;
  };
}

export interface ExternalPlayButtonConfig {
  visible?: boolean;
  icon: 'play' | 'play-circle' | 'triangle' | 'film';
  customIconUrl?: string;
  iconSize: number;
  iconColor: string;
  circleSize: number;
  circleBackground: string;
  circleOpacity: number;
  shape: 'circle' | 'rounded' | 'square';
  borderWidth: number;
  borderColor: string;
  shadow: string;
  glow: boolean;
  glowColor: string;
  position: 'center' | 'bottom-right' | 'bottom-left';
  animation: 'none' | 'pulse' | 'float' | 'spin-ring';
  animationSpeed: number;
  hoverEffect: 'scale' | 'glow' | 'color' | 'none';
  hoverColor: string;
  hoverBg?: string;
  hoverScale: number;
  hoverShadow: string;
  activeEffect?: 'press' | 'ring' | 'none';
  transitionSpeedMs?: number;
  showOnDesktop?: boolean;
  showOnMobile?: boolean;
  hoverPreviewMode: 'none' | 'muted';
  previewDuration: number;
  stopPreviewOnLeave: boolean;
  bottomGlow: boolean;
  bottomGlowColor: string;
  bottomGlowIntensity: number;
  bottomShadow: boolean;
  bottomShadowColor: string;
}

export interface PlayerControlItemConfig {
  enabled: boolean;
  icon?: string;
  customIconUrl?: string;
  size: number;
  color: string;
  background: string;
  shape: 'square' | 'rounded' | 'circle';
  borderColor: string;
  borderWidth: number;
  shadow: string;
  hoverColor: string;
  hoverBg: string;
  activeColor: string;
  spacing: number;
  showOnDesktop: boolean;
  showOnMobile: boolean;
  order: number;
}

export interface PlayerSettingsConfig {
  background: string;
  backgroundImage?: string;
  backgroundPattern?: DecorationRegionConfig['pattern'];
  width: string;
  height?: string;
  aspectRatio: '16/9' | '4/3' | '21/9' | 'auto';
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  shadow: string;
  shadowColor?: string;
  shadowBlur?: number;
  glow: string;
  glowColor?: string;
  padding?: number;
  marginY?: number;
  controlBarBackground: string;
  controlBarOpacity: number;
  controlBarHeight: number;
  controlBarPosition: 'bottom' | 'top';
  controlBarPaddingX?: number;
  controlBarPaddingY?: number;
  controlBarBorderColor?: string;
  controlBarBorderWidth?: number;
  controlBarShadow?: string;
  controlBarAnimation?: 'none' | 'fade' | 'slide';
  buttonOrder: string[];
  buttonVisibility: Record<string, boolean>;
  controlsConfig?: Record<string, PlayerControlItemConfig>;
  buttonSize: number;
  iconDesign: 'outline' | 'bold' | 'minimal';
  iconColor: string;
  hoverColor: string;
  activeColor: string;
  disabledColor: string;
  seekBarThickness: number;
  seekBarRadius?: number;
  seekBarColor: string;
  bufferedColor: string;
  playedColor: string;
  seekBarHoverColor?: string;
  showSeekThumb?: boolean;
  hoverPreviewEnabled?: boolean;
  transitionSpeedMs?: number;
  showVolumeSlider: boolean;
  timeTextColor: string;
  timeTextFont: string;
  fullscreenStyle: 'native' | 'theater-fallback';
  mobileCompactControls: boolean;
  enabledSpeeds: number[];
  defaultSpeed: number;
  autoQuality: boolean;
  defaultQuality?: string;
  allowManualQualitySwitch?: boolean;
  defaultAutoGenerateQualities?: string[];
  disabledQualities?: string[];
  downloadableQualities?: string[];
  menuBg?: string;
  menuText?: string;
  menuIconColor?: string;
  keyboardControls?: boolean;
  touchControls?: boolean;
  downloadEnabled: boolean;
  shareEnabled: boolean;
  pipEnabled: boolean;
  externalPlayButton: ExternalPlayButtonConfig;
}

export interface SubtitleStyleConfig {
  fontFamily: string;
  fontSizeDesktop: number;
  fontSizeMobile: number;
  fontWeight: string;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  outlineColor: string;
  outlineWidth: number;
  textShadow: string;
  textAlign: 'center' | 'right' | 'left';
  position: 'bottom' | 'top';
  bottomMargin: number;
  lineSpacing: number;
  maxWidthPercent: number;
  autoShowDefault?: boolean;
}

export interface CustomTextElementConfig {
  id: string;
  location: 'hero-top' | 'hero-bottom' | 'home-after-sections' | 'footer-top' | 'collection-top' | 'detail-top';
  text: string;
  visible: boolean;
  deleted: boolean;
  order: number;
  showDesktop: boolean;
  showTablet: boolean;
  showMobile: boolean;
  style: TextStyleConfig;
  background: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: string;
  padding: number;
}

export interface UiTextsConfig {
  loadingPlatform: string;
  loadingContent: string;
  loadingSearch: string;
  footerLinksTitle: string;
  footerEmailLabel: string;
  jsonFeedLabel: string;
  homeEmptySection: string;
  viewAllDefaultLabel: string;
  breadcrumbHome: string;
  allItemsFilter: string;
  allTypesFilter: string;
  sortNewest: string;
  sortOldest: string;
  sortViews: string;
  backToHomeLabel: string;
  collectionEmptyMessage: string;
  searchHeading: string;
  searchAllTypes: string;
  searchEmptyMessage: string;
  detailNotFound: string;
  downloadVideoLabel: string;
  downloadImageLabel: string;
  downloadAudioLabel: string;
  downloadDocumentLabel: string;
  documentAttachedLabel: string;
  shareLabel: string;
  copyLinkLabel: string;
  copiedLinkLabel: string;
  openExternalLinkLabel: string;
  viewsSuffix: string;
  fontScaleDecrease: string;
  fontScaleNormal: string;
  fontScaleIncrease: string;
  contentTypeLabels: Record<string, string>;
  customTextBlocks: CustomTextElementConfig[];
}

export interface HomepageSectionConfig {
  id: string;
  type:
    | 'latest-content'
    | 'latest-videos'
    | 'latest-images'
    | 'featured-videos'
    | 'featured-posts'
    | 'latest-poems'
    | 'featured-poems'
    | 'reports'
    | 'articles'
    | 'galleries'
    | 'archives'
    | 'announcement'
    | 'banner'
    | 'linked-image'
    | 'custom-text'
    | 'custom-buttons';
  title: string;
  subtitle: string;
  emptyMessage?: string;
  showEmptyMessage?: boolean;
  visible: boolean;
  deleted: boolean;
  showDesktop?: boolean;
  showTablet?: boolean;
  showMobile?: boolean;
  order: number;
  layout: 'grid' | 'list' | 'featured-split' | 'carousel';
  columns: number;
  cardStyle: 'editorial' | 'compact' | 'media-first';
  maxItems: number;
  sourcePageId: number | null;
  sourceChildPageId: number | null;
  contentType: string;
  sortBy: 'newest' | 'oldest' | 'views' | 'featured';
  manualItemIds: number[];
  bannerImageUrl?: string;
  bannerLinkUrl?: string;
  bannerLinkLabel?: string;
  bannerOpenNewTab?: boolean;
  bannerLinkEnabled?: boolean;
  bannerAlt?: string;
  customText?: string;
  customTextStyle?: Partial<TextStyleConfig>;
  buttonIds?: string[];
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: number;
  shadow?: string;
  maxWidth?: string;
  minHeight?: number;
  paddingY?: number;
  titleStyle?: Partial<TextStyleConfig>;
  subtitleStyle?: Partial<TextStyleConfig>;
  viewAllLabel: string;
  viewAllUrl: string;
  showViewAll: boolean;
}

export interface AllSettings {
  identity: {
    siteName: string;
    siteSubtitle: string;
    browserTitle: string;
    metaDescription: string;
    faviconUrl: string;
    faviconVersion: number;
    headerLogoUrl: string;
    footerLogoUrl: string;
    adminLogoUrl: string;
    loginLogoUrl: string;
    mobileLogoUrl: string;
    logoWidth: number;
    logoHeight: number;
    logoFit?: 'contain' | 'cover' | 'fill' | 'scale-down';
    logoHidden?: boolean;
    logoPosition: 'right' | 'center';
    showLogoInHeader: boolean;
    showLogoInFooter: boolean;
    siteImage?: {
      enabled: boolean;
      desktopUrl: string;
      mobileUrl: string;
      position: 'background' | 'above-title' | 'below-title' | 'right' | 'left';
      fit: 'cover' | 'contain' | 'fill';
      objectPosition: string;
      width: string;
      height: string;
      opacity: number;
      borderRadius: number;
      linkEnabled: boolean;
      linkUrl: string;
      openInNewTab: boolean;
      alt: string;
    };
    defaultShareImage: string;
    contactEmail: string;
    contactPhone: string;
    contactAddress: string;
    customFonts: Array<{ id: string; name: string; url: string; format: string }>;
  };
  colors: {
    primary: string;
    deepPrimary: string;
    secondary: string;
    accent: string;
    goldAccent: string;
    black: string;
    darkBg: string;
    white: string;
    lightBg: string;
    lightGray: string;
    mainText: string;
    secondaryText: string;
    border: string;
    icon: string;
    buttonBg: string;
    buttonText: string;
    hover: string;
    active: string;
    disabled: string;
    focus: string;
    shadowColor: string;
    glowColor: string;
    loadingColor: string;
    overlayColor: string;
    cardBorderWidth?: number;
    cardBorderRadius?: number;
    cardBorderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
    cardShadow?: string;
    customPresets?: Array<{
      id: string;
      name: string;
      colors: Record<string, string>;
    }>;
    targets: Record<
      | 'siteTitle'
      | 'pageHeading'
      | 'postTitle'
      | 'videoTitle'
      | 'imageTitle'
      | 'buttons'
      | 'navigation'
      | 'badges'
      | 'cards'
      | 'borders'
      | 'backgrounds'
      | 'icons'
      | 'separators'
      | 'playerControls'
      | 'loaders'
      | 'related'
      | 'admin',
      {
        color: string;
        background: string;
        borderColor: string;
        gradient: GradientConfig;
      }
    >;
  };
  typography: Record<
    | 'siteTitle'
    | 'navigation'
    | 'homeHeadings'
    | 'sectionHeadings'
    | 'postTitle'
    | 'videoTitle'
    | 'imageTitle'
    | 'description'
    | 'metadata'
    | 'related'
    | 'buttons'
    | 'footer'
    | 'adminSidebar'
    | 'adminHeadings'
    | 'adminInputs',
    TextStyleConfig
  >;
  decorations: Record<
    | 'header'
    | 'navSeparator'
    | 'hero'
    | 'homepage'
    | 'pages'
    | 'videoPages'
    | 'imagePages'
    | 'postCards'
    | 'footer'
    | 'adminDashboard',
    DecorationRegionConfig
  >;
  backgrounds: Record<
    'global' | 'hero' | 'homepage' | 'pages' | 'videoDetail' | 'imageDetail' | 'articleDetail' | 'footer',
    BackgroundRegionConfig
  >;
  navigation: {
    items: NavItemConfig[];
    backgroundColor: string;
    textColor: string;
    activeColor: string;
    hoverColor: string;
    dropdownBg: string;
    dropdownText: string;
    dropdownHoverBg: string;
    borderColor: string;
    shadow: string;
    height: number;
    itemSpacing: number;
    alignment: 'right' | 'center' | 'space-between';
    desktopDropdownTrigger?: 'hover' | 'click' | 'both';
    mobileMode: 'drawer' | 'accordion';
    animation: 'fade' | 'slide' | 'none';
  };
  footer: {
    enabled: boolean;
    text: string;
    copyright: string;
    backgroundColor: string;
    textColor: string;
    linkColor: string;
    separatorColor: string;
    showLogo: boolean;
    layout: 'columns' | 'centered' | 'minimal';
    links: Array<{ id: string; label: string; url: string; openInNewTab: boolean; visible: boolean }>;
    socialLinks: Array<{ id: string; platform: string; label: string; url: string; icon: string; visible: boolean }>;
  };
  player: PlayerSettingsConfig;
  loading: Record<
    'pageNav' | 'videoOpen' | 'videoBuffer' | 'upload' | 'processing' | 'download' | 'imageOpen' | 'relatedLoad',
    LoadingStyleConfig
  >;
  infoCard: InfoCardConfig;
  related: RelatedSettingsConfig;
  buttons: ButtonConfig[];
  links: {
    allowVideoDownload: boolean;
    allowAudioDownload: boolean;
    allowImageDownload: boolean;
    allowCopyLink: boolean;
    allowNativeShare: boolean;
    buttonStyles?: {
      downloadBg: string;
      downloadText: string;
      downloadHoverBg: string;
      shareBg: string;
      shareText: string;
      copyBg: string;
      copyText: string;
      borderRadius: number;
      size: 'sm' | 'md' | 'lg';
    };
    customLinks: Array<{
      id: string;
      label: string;
      url: string;
      icon: string;
      openInNewTab: boolean;
      visible: boolean;
      position: 'header' | 'footer' | 'detail' | 'sidebar';
      color: string;
      background: string;
      hoverColor: string;
    }>;
  };
  search: {
    enabled: boolean;
    buttonLabel: string;
    placeholder: string;
    showIcon: boolean;
    iconName: string;
    inputBg: string;
    inputText: string;
    inputBorder: string;
    buttonBg: string;
    buttonText: string;
    behavior: 'instant' | 'submit';
    searchableTypes: string[];
    searchablePageIds: number[];
    searchPageTitles?: boolean;
    resultsPerPage?: number;
    showResultCount?: boolean;
    resultsLayout: 'grid' | 'list';
    defaultSort: 'newest' | 'oldest' | 'views';
    showFilters: boolean;
    emptyMessage: string;
  };
  subtitles: SubtitleStyleConfig;
  homepage: {
    hero: {
      enabled: boolean;
      title: string;
      subtitle: string;
      introText: string;
      alignment: 'right' | 'center' | 'left';
      paddingY: number;
      minHeight: number;
      customImageUrl: string;
      showTitle: boolean;
      showSubtitle: boolean;
      showIntro: boolean;
      titleDeleted?: boolean;
      subtitleDeleted?: boolean;
      introDeleted?: boolean;
      showDesktop?: boolean;
      showTablet?: boolean;
      showMobile?: boolean;
      titleStyle?: Partial<TextStyleConfig>;
      subtitleStyle?: Partial<TextStyleConfig>;
      introStyle?: Partial<TextStyleConfig>;
      ctaButtonIds: string[];
    };
    sections: HomepageSectionConfig[];
  };
  uiTexts: UiTextsConfig;
  adminTheme: {
    mode: 'default' | 'light' | 'dark' | 'custom';
    sidebarBg: string;
    sidebarWidth: number;
    sidebarText: string;
    sidebarIconColor: string;
    activeMenuBg: string;
    activeMenuText: string;
    hoverBg: string;
    menuFont: string;
    menuFontSize: number;
    menuSpacing: number;
    menuItemHeight: number;
    sidebarHeaderBg: string;
    sidebarTitle: string;
    sidebarSubtitle: string;
    mainBg: string;
    cardBg: string;
    cardBorder: string;
    cardShadow: string;
    buttonBg: string;
    buttonText: string;
    inputBg: string;
    inputBorder: string;
    tableHeaderBg: string;
    scrollbarColor: string;
  };
  loginTheme: {
    bgColor: string;
    bgImageUrl: string;
    gradient: GradientConfig;
    cardBg: string;
    cardWidth: number;
    cardPosition: 'center' | 'right' | 'left';
    cardBorder: string;
    cardShadow: string;
    cardRadius: number;
    logoUrl: string;
    showLogo: boolean;
    title: string;
    subtitle: string;
    fontFamily: string;
    inputBg: string;
    inputText: string;
    inputBorder: string;
    buttonBg: string;
    buttonText: string;
    buttonRadius: number;
    hoverEffect: 'lift' | 'glow' | 'none';
    errorColor: string;
  };
  security: {
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    lockoutMinutes: number;
    requireTwoCodes: boolean;
    ipRateLimitEnabled: boolean;
  };
  other: {
    accessibilityFontWidgetEnabled: boolean;
    readingProgressBarEnabled: boolean;
    backToTopEnabled: boolean;
    backToTopLabel: string;
    announcementBarEnabled: boolean;
    announcementBarText: string;
    announcementBarLink: string;
    announcementBarBg: string;
    announcementBarColor: string;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    dateFormat: 'arabic' | 'iso' | 'relative';
    trackViews: boolean;
    jsonFeedEnabled: boolean;
    autoBackupEnabled: boolean;
  };
  overview: OverviewConfig;
  storage: StorageConfig;
  iconLibrary: IconAssetConfig[];
  customComponents: CustomComponentConfig[];
  i18n: SiteI18nConfig;
  officialAccount: OfficialAccountConfig;
  poetry: PoetrySettingsConfig;
  titleGradient: TitleGradientSystemConfig;
  seo: SeoSettingsConfig;
  backupSchedule: BackupScheduleConfig;
}

export interface SeoSettingsConfig {
  siteUrl: string;
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  defaultOgImage: string;
  robotsTxt: string;
  sitemapEnabled: boolean;
  structuredDataEnabled: boolean;
}

export interface BackupScheduleConfig {
  frequency: 'off' | 'daily' | 'weekly' | 'monthly';
  retentionCount: number;
  lastRunAt: string;
}

export type TitleGradientPresetId =
  | 'gold-metallic'
  | 'green-gold'
  | 'white-gold'
  | 'black-gold-white'
  | 'multi-gold'
  | 'custom';

export type TitleGradientTargetKey =
  | 'siteTitle'
  | 'heroTitle'
  | 'sectionHeadings'
  | 'pageBannerTitle'
  | 'postTitle'
  | 'videoTitle'
  | 'imageTitle'
  | 'poetryPageTitle'
  | 'poemCardTitle'
  | 'buttons'
  | 'navigation'
  | 'cards'
  | 'badges'
  | 'icons'
  | 'playerControls'
  | 'loaders';

export interface TitleGradientSystemConfig {
  enabled: boolean;
  preset: TitleGradientPresetId;
  mode?: 'sweep' | 'per-word' | 'per-letter';
  stops: string[];
  speed: number; // seconds per full RTL loop
  angle: number; // gradient angle (default 90deg horizontal for crisp RTL sweep)
  intensity: number; // 0.6..2 saturation multiplier
  opacity: number; // 0.2..1
  timingFunction: 'linear' | 'ease-in-out' | 'ease';
  loop: boolean;
  hoverBehavior: 'continue' | 'speedup' | 'pause' | 'highlight';
  targets: Record<TitleGradientTargetKey, boolean>;
  targetPageIds: number[]; // empty means all eligible pages
}

export interface PoetryShareButtonConfig {
  visible: boolean;
  label: string;
  icon: 'Feather' | 'PenLine' | 'Send' | 'Sparkles' | 'Plus' | 'none';
  color: string;
  bgColor: string;
  hoverBgColor: string;
  hoverColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: string;
  size: 'sm' | 'md' | 'lg';
  position: 'top-right' | 'top-center' | 'top-left';
  hoverEffect: 'none' | 'lift' | 'glow' | 'scale';
  clickEffect: 'press' | 'none';
}

export interface PoetryFormCustomField {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'email' | 'phone';
  required: boolean;
}

export interface PoetrySubmissionFormConfig {
  title: string;
  subtitle: string;
  width: string;
  bgColor: string;
  borderColor: string;
  borderRadius: number;
  textColor: string;
  labelColor: string;
  inputBg: string;
  inputText: string;
  inputBorder: string;
  inputRadius: number;
  textareaRows: number;
  labelTitle: string;
  placeholderTitle: string;
  labelVerses: string;
  placeholderVerses: string;
  showPoetName?: boolean;
  labelPoetName: string;
  placeholderPoetName: string;
  requirePoetName: boolean;
  showExtraInfo: boolean;
  labelExtraInfo: string;
  placeholderExtraInfo: string;
  requireExtraInfo: boolean;
  customFields?: PoetryFormCustomField[];
  maxCharacters: number;
  privacyNotice: string;
  submitLabel: string;
  submitBg: string;
  submitText: string;
  successMessage: string;
  errorMessage: string;
}

export interface PoetrySettingsConfig {
  pageTitle: string;
  pageSubtitle: string;
  headerBgColor: string;
  headerBgImage: string;
  headerOverlayOpacity: number;
  headerAlign: 'right' | 'center' | 'left';
  showBreadcrumb: boolean;
  pageBgColor: string;
  pageBgImage: string;
  pattern: DecorationRegionConfig['pattern'];
  patternPrimary: string;
  patternSecondary: string;
  patternOpacity: number;
  primaryColor: string;
  secondaryColor: string;
  goldColor: string;
  greenColor: string;
  titleStyle: TextStyleConfig;
  subtitleStyle: TextStyleConfig;
  poemTitleStyle: TextStyleConfig;
  poemVerseStyle: TextStyleConfig;
  poetNameStyle: TextStyleConfig;
  poemIntroStyle: TextStyleConfig;
  cardBg: string;
  cardAltBg: string;
  cardBorderColor: string;
  cardBorderWidth: number;
  cardBorderStyle: 'solid' | 'double' | 'dashed';
  cardBorderRadius: number;
  cardShadow: string;
  cardPadding: number;
  cardGap: number;
  separatorStyle: 'diamond' | 'line' | 'ornament' | 'star' | 'dots' | 'none';
  separatorColor: string;
  ornamentColor: string;
  hoverEffect: 'none' | 'lift' | 'glow' | 'border';
  entranceAnimation: 'none' | 'fade-up' | 'fade-in' | 'slide-right';
  columnsDesktop: number;
  columnsTablet: number;
  columnsMobile: number;
  poemsPerPage: number;
  paginationMode: 'pages' | 'load-more';
  defaultSort: 'pinned-newest' | 'newest' | 'oldest' | 'manual-order';
  showSearchFilter: boolean;
  showPoetFilter: boolean;
  customCss: string;
  submissionsEnabled: boolean;
  shareButton: PoetryShareButtonConfig;
  submissionForm: PoetrySubmissionFormConfig;
}

export interface PoemDesignOverride {
  bgColor?: string;
  bgImage?: string;
  cardBg?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  shadow?: string;
  titleColor?: string;
  verseColor?: string;
  poetColor?: string;
  introColor?: string;
  accentColor?: string;
  separatorStyle?: PoetrySettingsConfig['separatorStyle'] | '';
  separatorColor?: string;
  fontFamily?: string;
  alignment?: 'right' | 'center' | 'left' | '';
}

export interface PoemRecord {
  id: number;
  title: string;
  slug: string;
  verses_text: string;
  poet_name: string;
  intro_text: string;
  cover_image_url: string;
  status: 'draft' | 'published' | 'unpublished' | 'scheduled' | 'hidden' | 'deleted';
  pinned: number;
  sort_order: number;
  design_json: string;
  published_at: string | null;
  scheduled_at: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoemSubmissionRecord {
  id: number;
  title: string;
  verses_text: string;
  poet_name: string;
  extra_info: string;
  custom_fields_json?: string;
  status: 'pending' | 'approved' | 'private' | 'rejected' | 'deleted';
  admin_notes: string;
  published_poem_id: number | null;
  ip_hash: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoRenditionClient {
  label: string;
  height: number;
  width?: number;
  bitrate?: number;
  url: string;
  fileSize: number;
  isOriginal?: boolean;
  status?: 'waiting' | 'processing' | 'completed' | 'failed';
  enabled?: boolean;
  error?: string;
}

export interface OfficialAccountConfig {
  enabled: boolean;
  deleted: boolean;
  displayName: string;
  description: string;
  avatarUrl: string;
  wordingPrefix: string;
  showAvatar: boolean;
  showDescription: boolean;
  badgeEnabled: boolean;
  badgeIcon: 'BadgeCheck' | 'CheckCircle2' | 'ShieldCheck' | 'Award' | 'Star' | 'custom-svg';
  badgeCustomSvg: string;
  badgeColor: string;
  badgeSize: number;
  nameColor: string;
  nameFontFamily: string;
  nameFontSize: string;
  nameFontWeight: string;
  prefixColor: string;
  descriptionColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: string;
  padding: number;
  spacing: number;
  alignment: 'right' | 'center' | 'left';
  defaultPlacement: 'below-media' | 'below-title' | 'below-content';
}

export interface OverviewCardConfig {
  id: string;
  label: string;
  metricKey:
    | 'totalPages'
    | 'totalContent'
    | 'publishedContent'
    | 'draftContent'
    | 'videoCount'
    | 'imageCount'
    | 'articleCount'
    | 'storageUsedBytes'
    | 'recentErrors'
    | 'backupCount'
    | 'uploadsInProgress'
    | 'processingItems'
    | 'custom';
  subtitle?: string;
  icon: string;
  color: string;
  bgColor: string;
  visible: boolean;
  order: number;
  linkSection?: string;
  customValue?: string;
}

export interface OverviewConfig {
  cards: OverviewCardConfig[];
  recentActivityLimit: number;
  showQuickActions: boolean;
  showRecentPanel: boolean;
}

export interface StorageConfig {
  mode: 'local' | 's3' | 'r2' | 'gcs' | 'firebase';
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  publicBaseUrl: string;
  maxFileSizeMb: number;
  autoTranscodeOnUpload: boolean;
  autoExtractThumbnails: boolean;
}

export interface IconAssetConfig {
  id: string;
  name: string;
  kind: 'svg' | 'image';
  content: string;
  createdAt: string;
}

export interface CustomComponentConfig {
  id: string;
  name: string;
  location:
    | 'hero-top'
    | 'hero-bottom'
    | 'home-after-sections'
    | 'collection-top'
    | 'detail-top'
    | 'footer-top';
  html: string;
  css: string;
  js: string;
  visible: boolean;
  targetPageId?: number | null;
}

export interface SiteLanguageItem {
  code: string;
  label: string;
  dir: 'rtl' | 'ltr';
  overrides: Record<string, string>;
}

export interface SiteI18nConfig {
  enabled: boolean;
  showSwitcher: boolean;
  defaultLang: 'ar' | 'en';
  languages: SiteLanguageItem[];
}

export interface PageRecord {
  id: number;
  title: string;
  slug: string;
  parent_id: number | null;
  page_type: 'home' | 'collection' | 'videos' | 'images' | 'articles' | 'reports' | 'archive' | 'poetry' | 'static' | 'custom';
  layout: 'grid' | 'list' | 'editorial' | 'gallery';
  sort_order: number;
  status: 'published' | 'draft' | 'hidden' | 'deleted';
  nav_visible: number;
  aggregate_children: number;
  seo_title: string;
  seo_description: string;
  custom_content: string;
  sections_json: string;
  settings_json: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  children?: PageRecord[];
}

export interface ContentRecord {
  id: number;
  title: string;
  slug: string;
  content_type:
    | 'video'
    | 'image'
    | 'gallery'
    | 'post'
    | 'article'
    | 'news'
    | 'report'
    | 'poetry'
    | 'audio'
    | 'document'
    | 'custom';
  description: string;
  body: string;
  status: 'draft' | 'published' | 'unpublished' | 'scheduled' | 'hidden' | 'archived' | 'processing' | 'failed' | 'deleted';
  featured: number;
  page_id: number | null;
  child_page_id: number | null;
  extra_page_ids_json: string;
  category: string;
  tags_json: string;
  thumbnail_url: string;
  media_url: string;
  media_file_id: number | null;
  gallery_urls_json: string;
  link_url: string;
  link_label?: string;
  link_enabled: number;
  link_new_tab: number;
  duration: number;
  resolution: string;
  width: number;
  height: number;
  views: number;
  source_label: string;
  editor_label: string;
  custom_metadata_json: string;
  settings_json: string;
  published_at: string | null;
  scheduled_at: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  page_title?: string;
  child_page_title?: string;
}

export interface MediaFileRecord {
  id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  public_url: string;
  mime_type: string;
  media_kind: 'video' | 'image' | 'audio' | 'document' | 'font' | 'favicon' | 'other';
  file_size: number;
  sha256: string;
  width: number;
  height: number;
  duration: number;
  status: 'ready' | 'processing' | 'failed';
  processing_progress: number;
  error_message: string;
  thumbnails_json: string;
  renditions_json: string;
  created_at: string;
}

export interface SubtitleCue {
  id: string;
  start: string; // HH:MM:SS.mmm
  end: string;
  text: string;
}

export interface SubtitleTrackRecord {
  id: number;
  content_id: number;
  language: string;
  language_label: string;
  title: string;
  cues_json: string;
  style_json: string;
  visible: number;
  is_default?: number;
  status: 'published' | 'draft' | 'hidden';
  created_at: string;
  updated_at: string;
}
