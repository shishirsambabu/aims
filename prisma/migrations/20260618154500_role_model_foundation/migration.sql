-- Role model foundation for the imported fruit warehouse and cold-storage ERP.
-- This keeps the legacy roles alive while introducing the new operational roles.

ALTER TYPE "Role" ADD VALUE 'gm';
ALTER TYPE "Role" ADD VALUE 'sales_executive';
ALTER TYPE "Role" ADD VALUE 'warehouse';
