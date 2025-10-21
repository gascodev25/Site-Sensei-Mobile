# ACG Works Warehouse & Service Management System

## Overview

This is a comprehensive warehouse and service management system designed specifically for ACG Works' field service operations in South Africa. The application provides a unified control center for scheduling contract installations and recurring services, tracking equipment and consumables from warehouse to field, managing team assignments and stock issuance, and monitoring key operational metrics. It features a professional dashboard with color-coded alerts, intuitive navigation, and data visualization capabilities.

The system is built as a full-stack web application using modern technologies including React for the frontend, Express.js for the backend API, PostgreSQL with Drizzle ORM for data persistence, and comprehensive UI components for a professional user experience. All pricing is displayed in South African Rands (R) and the address search functionality is optimized for South African locations.

## Recent Changes

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

**Series Splitting for Equipment & Consumables (October 2025)**
- Implemented series splitting capability for recurring services when equipment or consumables change
- When editing a recurring service from the calendar, changes to equipment items, consumable items, or service intervals trigger a split confirmation dialog
- Users can choose to apply changes from a specific date forward (creates new service series) or modify the entire series
- The split operation maintains data integrity by ending the original series one day before the split date and creating a new series with updated stock assignments
- Warehouse forecasting automatically updates after splits through cache invalidation
- All stock assignments (equipment and consumables) are properly copied to the new service series

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