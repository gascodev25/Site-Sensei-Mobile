# Warehouse & Service Management System

## Overview

This is a comprehensive warehouse and service management system designed for field service operations. The application provides a unified control center for scheduling contract installations and recurring services, tracking equipment and consumables from warehouse to field, managing team assignments and stock issuance, and monitoring key operational metrics. It features a dashboard-driven interface inspired by Brightpearl's design philosophy with color-coded alerts, intuitive navigation, and data visualization capabilities.

The system is built as a full-stack web application using modern technologies including React for the frontend, Express.js for the backend API, PostgreSQL with Drizzle ORM for data persistence, and comprehensive UI components for a professional user experience.

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
- Replit OAuth integration for seamless authentication
- Session-based authentication with secure HTTP-only cookies
- Role-based permissions system (super_user, general_manager, ops_manager, admin, warehouse_clerk, team_member)
- Permission utilities for fine-grained access control
- Automatic user provisioning from Replit identity provider

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
- Replit OAuth/OpenID Connect for user authentication
- Connect-pg-simple for PostgreSQL session storage
- Passport.js with OpenID Connect strategy

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
- Support for Australian address formatting and validation

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