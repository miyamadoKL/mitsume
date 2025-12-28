export interface User {
  id: string
  email: string
  name: string
  auth_provider: string
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface SavedQuery {
  id: string
  user_id: string
  name: string
  description: string | null
  query_text: string
  created_at: string
  updated_at: string
}

export interface QueryHistory {
  id: string
  user_id: string
  query_text: string
  status: 'success' | 'error' | 'cancelled'
  execution_time_ms: number | null
  row_count: number | null
  error_message: string | null
  executed_at: string
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  row_count: number
  execution_time_ms: number
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  comment?: string
  ordinal_position: number
}

export type PermissionLevel = 'view' | 'edit' | 'owner' | ''

// Parameter Definition Types for Dashboard Filters
export type ParameterType = 'text' | 'number' | 'date' | 'daterange' | 'select' | 'multiselect'
export type SqlFormat = 'raw' | 'string' | 'number' | 'date' | 'identifier' | 'string_list' | 'number_list'
export type EmptyBehavior = 'missing' | 'null' | 'match_none'

export interface ParameterOption {
  value: string
  label: string
}

export interface DateRangeTargets {
  start: string
  end: string
}

export interface ParameterDefinition {
  name: string
  type: ParameterType
  label?: string
  required?: boolean
  sql_format?: SqlFormat
  targets?: DateRangeTargets
  default_value?: string | string[] | { start: string; end: string }
  options?: ParameterOption[]
  options_query_id?: string
  depends_on?: string[]
  empty_behavior?: EmptyBehavior
}

export interface DashboardPermission {
  id: string
  dashboard_id: string
  user_id?: string
  role_id?: string
  permission_level: PermissionLevel
  granted_at: string
  granted_by?: string
  user_email?: string
  user_name?: string
  role_name?: string
}

export interface Dashboard {
  id: string
  user_id: string
  name: string
  description: string | null
  layout: LayoutItem[]
  is_public?: boolean
  parameters?: ParameterDefinition[]
  is_draft?: boolean
  draft_of?: string  // Original dashboard ID if this is a draft
  created_at: string
  updated_at: string
  widgets?: Widget[]
  my_permission?: PermissionLevel
  permissions?: DashboardPermission[]
}

export interface GrantPermissionRequest {
  user_id?: string
  role_id?: string
  permission_level: 'view' | 'edit'
}

export interface UpdateVisibilityRequest {
  is_public: boolean
}

export interface Widget {
  id: string
  dashboard_id: string
  name: string
  query_id: string | null
  chart_type: ChartType
  chart_config: ChartConfig
  position: Position
  responsive_positions?: ResponsivePositions
  created_at: string
  updated_at: string
}

export interface Position {
  x: number
  y: number
  w: number
  h: number
}

export type Breakpoint = 'lg' | 'md' | 'sm' | 'xs'

export interface ResponsivePositions {
  lg?: Position
  md?: Position
  sm?: Position
  xs?: Position
}

export interface LayoutItem extends Position {
  i: string
}

// Chart types - grouped by implementation phase
export type ChartType =
  // Phase 0: Existing types
  | 'bar' | 'line' | 'pie' | 'area' | 'scatter'
  | 'table' | 'markdown' | 'counter' | 'pivot'
  // Phase 1: Basic chart enhancements
  | 'donut' | 'combo' | 'heatmap'
  // Phase 2: KPI & Metrics
  | 'gauge' | 'progress'
  // Phase 4: Advanced visualization
  | 'funnel' | 'treemap' | 'bubble' | 'sunburst' | 'boxplot'

// Drilldown Types
export interface ColumnLinkConfig {
  column: string           // Target column name
  targetDashboardId: string // Dashboard ID to navigate to
  parameterMapping: Record<string, string>  // Param name → column name or "@" for current cell
  textTemplate?: string    // Optional display text template (e.g., "View {{@}}")
}

export interface ChartDrilldownConfig {
  targetDashboardId: string        // Dashboard ID to navigate to
  parameterMapping: Record<string, string>  // Param name → "name"|"value"|"series"|column name
}

// Cross-filter: clicking on a chart updates parameters on the same dashboard
export interface CrossFilterConfig {
  enabled: boolean
  parameterMapping: Record<string, string>  // Param name → "name"|"value"|"series"|column name
}

// ============================================
// Nested Chart Config Types (Phase 0.2+)
// ============================================

/**
 * Common config for cartesian (x/y axis) charts: bar, line, area
 */
export interface CartesianConfig {
  stacking?: 'none' | 'normal' | 'percent'
}

/**
 * Config for combo charts (mixed bar/line/area)
 */
export interface ComboConfig {
  seriesTypes?: Record<string, 'bar' | 'line' | 'area'>
  dualYAxis?: boolean
}

/**
 * Config for heatmap charts
 */
export interface HeatmapConfig {
  xColumn: string
  yColumn: string
  valueColumn: string
  colorScheme?: string
  showValues?: boolean
}

/**
 * Config for gauge charts
 */
export interface GaugeConfig {
  min: number
  max: number
  ranges?: { from: number; to: number; color: string; label?: string }[]
  showPointer?: boolean
}

/**
 * Config for progress bar charts
 */
export interface ProgressConfig {
  targetValue: number
  showPercentage?: boolean
  color?: string
  backgroundColor?: string
}

/**
 * Config for treemap charts
 */
export interface TreemapConfig {
  hierarchyColumns: string[]
  valueColumn: string
  labelColumn?: string
}

/**
 * Config for bubble charts
 */
export interface BubbleConfig {
  xColumn: string
  yColumn: string
  sizeColumn: string
  colorColumn?: string
  maxBubbleSize?: number
}

/**
 * Config for funnel charts
 */
export interface FunnelConfig {
  labelColumn: string
  valueColumn: string
  sortOrder?: 'descending' | 'ascending' | 'none'
  labelPosition?: 'left' | 'right' | 'inside'
  showPercentage?: boolean
}

/**
 * Config for sunburst charts
 */
export interface SunburstConfig {
  hierarchyColumns: string[]
  valueColumn: string
  labelColumn?: string
}

/**
 * Config for boxplot charts
 */
export interface BoxplotConfig {
  categoryColumn: string
  valueColumn: string
  showOutliers?: boolean
}

/**
 * Common axis configuration
 */
export interface AxisDetailConfig {
  label?: string
  rotate?: number
  min?: number
  max?: number
  scale?: 'linear' | 'log'
}

/**
 * Legend configuration
 */
export interface LegendConfig {
  show?: boolean
  position?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Data zoom configuration for time series
 */
export interface DataZoomConfig {
  enabled: boolean
  type?: 'inside' | 'slider' | 'both'
  start?: number
  end?: number
}

/**
 * Time series specific configuration
 */
export interface TimeSeriesConfig {
  enabled?: boolean
  timeColumn?: string
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count'
  rollingWindow?: {
    enabled: boolean
    periods: number
    function: 'mean' | 'sum' | 'min' | 'max'
  }
  cumulative?: {
    enabled: boolean
  }
}

/**
 * Comparison configuration for counter/KPI
 */
export interface ComparisonConfig {
  type: 'previous_row' | 'target' | 'none'
  targetValue?: number
  showPercentChange?: boolean
  invertColors?: boolean
}

/**
 * Conditional formatting for counter/table
 */
export interface ConditionalFormatRule {
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between'
  value: number | [number, number]
  backgroundColor?: string
  textColor?: string
}

/**
 * Sparkline configuration for counter widget
 */
export interface SparklineConfig {
  enabled: boolean
  type: 'line' | 'bar' | 'area'
  column: string
}

export interface ChartConfig {
  // Basic axis config (shared by bar, line, area, scatter)
  xAxis?: string
  yAxis?: string | string[]
  series?: string[]
  title?: string
  legend?: boolean
  content?: string  // Markdown content for markdown widget

  // Counter widget config
  valueColumn?: string  // Column to display as counter value
  counterLabel?: string  // Label below the counter
  counterPrefix?: string  // Prefix (e.g., "$")
  counterSuffix?: string  // Suffix (e.g., "%")

  // Pivot widget config
  rowGroupColumn?: string  // Column for row grouping
  colGroupColumn?: string  // Column for column grouping
  valueAggColumn?: string  // Column to aggregate
  aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max'  // Aggregation function

  // Drilldown config
  columnLinks?: ColumnLinkConfig[]     // Table column link settings
  drilldown?: ChartDrilldownConfig     // Chart drilldown settings

  // Cross-filter config
  crossFilter?: CrossFilterConfig      // Cross-filter settings for same-dashboard filtering

  // ============================================
  // Nested configs for specific chart types
  // ============================================

  // Cartesian charts (bar, line, area) - stacking support
  cartesianConfig?: CartesianConfig

  // Combo chart (mixed bar/line/area)
  comboConfig?: ComboConfig

  // Heatmap
  heatmapConfig?: HeatmapConfig

  // Gauge chart
  gaugeConfig?: GaugeConfig

  // Progress bar
  progressConfig?: ProgressConfig

  // Treemap
  treemapConfig?: TreemapConfig

  // Bubble chart
  bubbleConfig?: BubbleConfig

  // Funnel chart
  funnelConfig?: FunnelConfig

  // Sunburst chart
  sunburstConfig?: SunburstConfig

  // Boxplot chart
  boxplotConfig?: BoxplotConfig

  // ============================================
  // Common enhanced configs
  // ============================================

  // Axis detail settings
  axisConfig?: {
    xAxis?: AxisDetailConfig
    yAxis?: AxisDetailConfig
  }

  // Legend settings
  legendConfig?: LegendConfig

  // Data zoom for time series
  dataZoom?: DataZoomConfig

  // Time series features
  timeSeriesConfig?: TimeSeriesConfig

  // Counter/KPI comparison
  comparison?: ComparisonConfig

  // Conditional formatting (counter, table)
  conditionalFormatting?: {
    column?: string
    rules: ConditionalFormatRule[]
  }[]

  // Sparkline for counter widget
  sparkline?: SparklineConfig

  // Color scheme
  colorScheme?: string
  customColors?: string[]
}

export interface CreateDashboardRequest {
  name: string
  description?: string
}

export interface CreateWidgetRequest {
  name: string
  query_id?: string
  chart_type: ChartType
  chart_config: ChartConfig
  position: Position
  responsive_positions?: ResponsivePositions
}

export interface UpdateWidgetRequest {
  name?: string
  query_id?: string | null
  chart_type?: ChartType
  chart_config?: ChartConfig
  position?: Position
  responsive_positions?: ResponsivePositions
}

export interface BatchWidgetUpdateRequest {
  create?: CreateWidgetRequest[]
  update?: Record<string, UpdateWidgetRequest>
  delete?: string[]
}

export interface BatchWidgetUpdateResponse {
  created?: Widget[]
  updated?: Widget[]
  deleted?: string[]
}

// Notification Types
export type ChannelType = 'slack' | 'email' | 'google_chat'

export interface NotificationChannel {
  id: string
  user_id: string
  name: string
  channel_type: ChannelType
  config: SlackChannelConfig | EmailChannelConfig | GoogleChatChannelConfig
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface SlackChannelConfig {
  webhook_url: string
}

export interface EmailChannelConfig {
  recipients: string[]
}

export interface GoogleChatChannelConfig {
  webhook_url: string
}

export interface CreateNotificationChannelRequest {
  name: string
  channel_type: ChannelType
  config: SlackChannelConfig | EmailChannelConfig | GoogleChatChannelConfig
}

export interface UpdateNotificationChannelRequest {
  name?: string
  config?: SlackChannelConfig | EmailChannelConfig | GoogleChatChannelConfig
}

// Alert Types
export type ConditionOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'neq' | 'contains'
export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first'

export interface QueryAlert {
  id: string
  user_id: string
  query_id: string
  name: string
  description: string | null
  condition_column: string
  condition_operator: ConditionOperator
  condition_value: string
  aggregation: Aggregation | null
  check_interval_minutes: number
  cooldown_minutes: number
  is_active: boolean
  last_checked_at: string | null
  last_triggered_at: string | null
  next_check_at: string | null
  channel_ids: string[]
  created_at: string
  updated_at: string
}

export interface CreateAlertRequest {
  query_id: string
  name: string
  description?: string
  condition_column: string
  condition_operator: ConditionOperator
  condition_value: string
  aggregation?: Aggregation
  check_interval_minutes?: number
  cooldown_minutes?: number
  channel_ids: string[]
}

export interface UpdateAlertRequest {
  name?: string
  description?: string
  condition_column?: string
  condition_operator?: ConditionOperator
  condition_value?: string
  aggregation?: Aggregation
  check_interval_minutes?: number
  cooldown_minutes?: number
  is_active?: boolean
  channel_ids?: string[]
}

export interface AlertHistory {
  id: string
  alert_id: string
  triggered_at: string
  condition_met_value: string | null
  notification_status: string
  notification_details: Record<string, unknown> | null
  error_message: string | null
}

export interface AlertTestResult {
  triggered: boolean
  actual_value: string
  condition: {
    column: string
    operator: string
    value: string
  }
  notification_sent?: boolean
}

// Subscription Types
export interface DashboardSubscription {
  id: string
  user_id: string
  dashboard_id: string
  name: string
  schedule_cron: string
  timezone: string
  format: 'pdf' | 'png'
  is_active: boolean
  last_sent_at: string | null
  next_run_at: string | null
  channel_ids: string[]
  created_at: string
  updated_at: string
}

export interface CreateSubscriptionRequest {
  dashboard_id: string
  name: string
  schedule_cron: string
  timezone?: string
  format?: 'pdf' | 'png'
  channel_ids: string[]
}

export interface UpdateSubscriptionRequest {
  name?: string
  schedule_cron?: string
  timezone?: string
  format?: 'pdf' | 'png'
  is_active?: boolean
  channel_ids?: string[]
}

// Role Types
export interface Role {
  id: string
  name: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface RoleWithCatalogs extends Role {
  catalogs: string[]
}

export interface UserWithRoles extends User {
  roles: Role[]
}

export interface CreateRoleRequest {
  name: string
  description?: string
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
}

export interface SetCatalogPermissionsRequest {
  catalogs: string[]
}

export interface AssignRoleRequest {
  role_id: string
}

// Layout Template Types
export interface LayoutTemplate {
  id: string
  name: string
  description: string
  thumbnail?: string
  layout: Position[]
  user_id?: string
  is_system: boolean
  created_at?: string
}

// Widget Data API Types
export interface WidgetDataRequest {
  parameters?: Record<string, unknown>
}

export interface WidgetDataResponse {
  widget_id: string
  query_result?: QueryResult
  error?: string
  required_parameters?: string[]
  missing_parameters?: string[]
}

// Metadata Search Types
export interface MetadataSearchResult {
  catalog: string
  schema: string
  table: string
  column?: string
  type: 'table' | 'column'
}

export interface MetadataSearchRequest {
  query: string
  search_type?: 'table' | 'column' | 'all'
  limit?: number
}
