# ACG Works Warehouse & Service Management System

## Overview

This is a comprehensive warehouse and service management system designed specifically for ACG Works' field service operations in South Africa. The application provides a unified control center for scheduling contract installations and recurring services, tracking equipment and consumables from warehouse to field, managing team assignments and stock issuance, and monitoring key operational metrics. It features a professional dashboard with color-coded alerts, intuitive navigation, and data visualization capabilities.

The system is built as a full-stack web application using modern technologies including React for the frontend, Express.js for the backend API, PostgreSQL with Drizzle ORM for data persistence, and comprehensive UI components for a professional user experience. All pricing is displayed in South African Rands (R) and the address search functionality is optimized for South African locations.

## Recent Changes

**Manager Field Report Alerts (March 2026)**
- Added `GET /api/field-reports/batch?serviceIds=...` endpoint for efficient batch flag retrieval
- Added `getLatestFieldReportFlags(serviceIds)` storage method — returns latest `hasAdjustments` flag per service
- Service cards in list view now show an orange "Adjusted" badge when the latest field report has quantity adjustments
- Calendar items show an orange `AlertTriangle` icon when a service has adjustments
- `ServiceCalendar` accepts optional `adjustedServiceIds` prop for badge display
- Added `FieldReportPanel` component (`client/src/components/FieldReportPanel.tsx`) — collapsible section in the service detail (edit) dialog showing: actual vs planned consumables with differences highlighted in orange, team/client signature images, photo gallery (3-col thumbnail grid, click to expand), notes
- FieldReportPanel is embedded in `ServiceForm` when editing an existing service; returns null if no field report exists (backward compatible)

**Android Mobile App for Field Teams (March 2026)**
- Full Expo/React Native app in `mobile-app/` subfolder
- Screens: Login, ServiceList (Today/Week/Month), ServiceDetail, FieldCompletion (5-step), Success
- FieldCompletion photos displayed in 2-column thumbnail grid with overlay remove button
- GitHub Actions workflow at `.github/workflows/build-android-mobile.yml` for EAS Build
- API: `GET /api/mobile/services`, `POST /api/field-reports`, `GET /api/field-reports/:serviceId`
- Production backend URL: `https://stock-schedule-gavinbgreen.replit.app`

**Mobile App Production Fixes (March 2026)**
- Disabled New Architecture (`newArchEnabled: false`) in `app.json` — `react-native-signature-canvas` is incompatible with RN 0.76 New Architecture, causing silent crash on startup
- Added `usesCleartextTraffic: true` to Android config — prevents Android from blocking API calls
- Added splash screen image and `expo-splash-screen` plugin — fixes blank screen on launch
- Set `EXPO_PUBLIC_API_BASE_URL` in `eas.json` env sections for all build profiles — production points to deployed Replit backend
- Bumped `versionCode` to 4 for new Play Store submission

**Field Reports Backend (March 2026)**
- `field_reports` table: serviceId, completionDate, actualConsumables, teamSignature, clientSignature, photos, hasAdjustments, stockDeducted, notes
- `linkedTeamId` on users table for field team assignment
- Shared completion helpers: `coreUpdateServiceStatus()`, `coreDeductConsumableStock()`, `reconcileConsumableStockDelta()`

**Hybrid Authentication System with Username/Password (October 2025)**
- Implemented custom username/password authentication as primary login method
- Added bcrypt password hashing (12 rounds) for secure credential storage
- Created hybrid authentication: Passport Local Strategy + Replit OAuth as fallback option
- Built user management interface for superusers and managers to create/edit/delete users
- Implemented three-tier role system: superuser (full access), manager (user management + features), user (feature access only)
- Added bootstrap endpoint to create initial superuser account (gavin@gasco.digital / ChangeMe123!)
- Fixed critical bug where OAuth users couldn't access protected routes by implementing getUserWithRoles helper
- Both authentication methods share same session store and role-based access control system
- Login page features username/password form with optional "Sign in with Replit" button

**Service Update & Series Splitting Fix (February 2026)**
- Fixed service duplication bug: updating equipment or consumables on a service no longer creates a duplicate service
- Equipment and consumable changes now update the existing service's stock assignments in-place via the PUT endpoint
- Only recurrence interval changes trigger the series split dialog (creates new series from date forward)
- Storage layer uses diff-based updates for service_stock_issued: preserves returned status and other fields, only adds/removes/updates changed items
- PUT route manages equipment status transitions (in_warehouse/in_field) when equipment is added or removed from a service
- Split logic only passes equipment/consumable data to new series when those items actually changed

**Daily Stock Forecast with Timezone Support (October 2025)**
- Implemented getDailyStockForecast() method providing accurate per-day consumable requirements for 28-day forecast period
- Added /api/warehouse/daily-forecast endpoint returning date-specific consumable needs based on scheduled services
- Fixed critical timezone issue: database stores UTC timestamps (timestamp without timezone), application converts to SAST (UTC+2) for correct date matching
- Recurring services now use earliest completed_date as anchor point instead of installation_date for accurate schedule calculation
- Query optimization: fetches all active recurring services (not just those starting in forecast period) to catch long-running recurring service occurrences
- Daily view shows "No services scheduled" for days with zero requirements instead of misleading averages
- Warehouse forecast supports both weekly aggregates and daily breakdowns for different planning needs

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

**Frontend Architecture**
- React 18 with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for client-side routing instead of React Router
- TanStack React Query for server state management and caching
- React Hook Form with Zod validation for form handling
- Shadcn/UI component library built on Radix UI primitives
- Tailwind CSS for styling with custom design system variables
- Component-based architecture with clear separation of concerns

**Backend Architecture**  
- Express.js server with TypeScript
- RESTful API design with structured route handlers
- Replit authentication integration using OpenID Connect
- Session-based authentication with PostgreSQL session storage
- Comprehensive error handling and request logging middleware
- Storage abstraction layer for database operations
- Environment-based configuration management

**Database Design**
- PostgreSQL database with Drizzle ORM for type-safe database operations
- Schema-first approach with shared TypeScript types
- Tables for users, clients, equipment, consumables, services, team members, service teams, and audit logging
- Support for geographic data (latitude/longitude) for client locations
- Flexible service scheduling with recurrence pattern support
- Role-based access control through user roles field

**Authentication & Authorization**
- Hybrid authentication system: Passport Local Strategy (username/password) as primary method
- Replit OAuth/OpenID Connect available as optional fallback authentication
- Session-based authentication with secure HTTP-only cookies and PostgreSQL session storage
- Bcrypt password hashing with 12 salt rounds for local authentication
- Three-tier role system: superuser, manager, user
- Role-based access control enforced on both frontend (UI conditionals) and backend (middleware)
- getUserWithRoles helper ensures OAuth users load database roles for proper permission checks
- User management interface for superusers/managers to create and manage user accounts
- Bootstrap endpoint (/api/auth/bootstrap) for initial superuser creation
- Permission utilities (requireRole, hasRole, getPermissions) for fine-grained access control

**UI/UX Design System**
- Brightpearl-inspired dashboard with clean, professional aesthetics
- Comprehensive component library with consistent styling
- Responsive design supporting desktop, tablet, and mobile devices
- Color-coded status system for services (scheduled, completed, missed)
- Data visualization with custom charts and KPI cards
- Accessibility-focused components using Radix UI primitives

**State Management Strategy**
- TanStack React Query for server state with automatic caching and synchronization
- Local component state for UI interactions
- Form state managed through React Hook Form
- Global authentication state through custom hooks
- Optimistic updates for improved user experience

## External Dependencies

**Database & Infrastructure**
- Neon Database (PostgreSQL) - serverless PostgreSQL database
- Replit hosting platform with integrated development environment
- Drizzle Kit for database migrations and schema management

**Authentication Services**
- Passport.js with Local Strategy for username/password authentication
- Passport.js with OpenID Connect strategy for Replit OAuth (optional fallback)
- Bcrypt for secure password hashing and verification
- Connect-pg-simple for PostgreSQL session storage
- Express-session for session management with secure cookies

**Frontend Libraries**
- Radix UI primitives for accessible component foundations
- TanStack React Table for advanced data table functionality
- React Hook Form with Hookform Resolvers for form validation
- Zod for runtime type validation and schema parsing
- Date-fns for date manipulation and formatting
- Lucide React for consistent iconography

**Mapping & Location Services**
- OpenStreetMap Nominatim API for address autocomplete and geocoding
- Geographic coordinate storage for client locations
- Support for South African address formatting and validation

**Development & Build Tools**
- Vite with React plugin for fast development and optimized builds
- ESBuild for server-side bundling
- TypeScript for type safety across the entire application
- Tailwind CSS with PostCSS for styling
- Replit-specific plugins for development environment integration

**Monitoring & Developer Experience**
- Runtime error overlay for development debugging
- Request/response logging middleware
- Comprehensive error boundaries and user feedback systems
- Toast notifications for user feedback and error handling