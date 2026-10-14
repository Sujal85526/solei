-- Permission keys and launch roles. Mirrors src/lib/permissions.ts (kept in sync by a unit test).

insert into public.permissions (key, "group", description, sort) values
  ('dashboard.view', 'General', 'See the dashboard', 0),
  ('pos.use', 'Sales', 'Use the event POS', 1),
  ('orders.view', 'Sales', 'View orders and payments', 2),
  ('orders.create', 'Sales', 'Create manual orders', 3),
  ('orders.update', 'Sales', 'Change order status, delivery and notes', 4),
  ('orders.cancel', 'Sales', 'Cancel orders (returns stock, reverses stamps)', 5),
  ('orders.refund', 'Sales', 'Record refunds', 6),
  ('orders.price_override', 'Sales', 'Override prices on manual orders', 7),
  ('payments.record', 'Sales', 'Record cash, transfer and terminal payments', 8),
  ('payment_links.create', 'Sales', 'Create and send payment links', 9),
  ('catalog.view', 'Catalog', 'View all products, including inactive', 10),
  ('catalog.manage', 'Catalog', 'Create and edit products, prices and images', 11),
  ('inventory.view', 'Inventory', 'View stock levels and movements', 12),
  ('inventory.receive', 'Inventory', 'Receive stock', 13),
  ('inventory.adjust', 'Inventory', 'Record damage and corrections', 14),
  ('inventory.transfer', 'Inventory', 'Transfer stock between locations', 15),
  ('customers.view', 'Customers', 'View customers', 16),
  ('customers.manage', 'Customers', 'Create and edit customers', 17),
  ('events.view', 'Events', 'View the event calendar', 18),
  ('events.manage', 'Events', 'Create and edit events, expenses and documents', 19),
  ('bookings.view', 'Events', 'View booking requests', 20),
  ('bookings.manage', 'Events', 'Reply, quote, approve and reject bookings', 21),
  ('loyalty.view', 'Loyalty', 'View passports and stamps', 22),
  ('loyalty.adjust', 'Loyalty', 'Add or remove stamps manually, issue passports', 23),
  ('loyalty.manage', 'Loyalty', 'Change loyalty programme rules', 24),
  ('reports.view', 'Reports', 'View sales reports (units, revenue)', 25),
  ('reports.financial.view', 'Reports', 'See costs, COGS, expenses and profit', 26),
  ('notifications.manage', 'Settings', 'Edit notification templates', 27),
  ('settings.manage', 'Settings', 'Change business settings', 28),
  ('staff.manage', 'Settings', 'Manage staff accounts, roles and permissions', 29),
  ('audit.view', 'Settings', 'View the activity log', 30);

insert into public.roles (key, name, description, requires_mfa, is_system) values
  ('owner', 'Owner', 'Full access to everything', true, true),
  ('manager', 'Manager', 'Runs operations; cannot manage staff', true, true),
  ('sales_staff', 'Sales staff', 'POS, orders, customers and stock availability — no costs or profit', false, true);

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.key = 'owner' and p.key in (
  'dashboard.view',
  'pos.use',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'orders.refund',
  'orders.price_override',
  'payments.record',
  'payment_links.create',
  'catalog.view',
  'catalog.manage',
  'inventory.view',
  'inventory.receive',
  'inventory.adjust',
  'inventory.transfer',
  'customers.view',
  'customers.manage',
  'events.view',
  'events.manage',
  'bookings.view',
  'bookings.manage',
  'loyalty.view',
  'loyalty.adjust',
  'loyalty.manage',
  'reports.view',
  'reports.financial.view',
  'notifications.manage',
  'settings.manage',
  'staff.manage',
  'audit.view'
);

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.key = 'manager' and p.key in (
  'dashboard.view',
  'pos.use',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'orders.refund',
  'orders.price_override',
  'payments.record',
  'payment_links.create',
  'catalog.view',
  'catalog.manage',
  'inventory.view',
  'inventory.receive',
  'inventory.adjust',
  'inventory.transfer',
  'customers.view',
  'customers.manage',
  'events.view',
  'events.manage',
  'bookings.view',
  'bookings.manage',
  'loyalty.view',
  'loyalty.adjust',
  'loyalty.manage',
  'reports.view',
  'reports.financial.view',
  'notifications.manage',
  'settings.manage',
  'audit.view'
);

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.key = 'sales_staff' and p.key in (
  'dashboard.view',
  'pos.use',
  'orders.view',
  'orders.create',
  'payments.record',
  'payment_links.create',
  'catalog.view',
  'inventory.view',
  'customers.view',
  'customers.manage',
  'events.view',
  'bookings.view',
  'loyalty.view'
);

-- Default delivery fees per emirate (owner edits in Admin → Settings). ❓ confirm with client.
insert into public.delivery_zones (emirate, name, fee_fils, sort) values
  ('abu_dhabi', 'Abu Dhabi', 2000, 1),
  ('dubai', 'Dubai', 2500, 2),
  ('sharjah', 'Sharjah', 2500, 3),
  ('ajman', 'Ajman', 2500, 4),
  ('umm_al_quwain', 'Umm Al Quwain', 3000, 5),
  ('ras_al_khaimah', 'Ras Al Khaimah', 3000, 6),
  ('fujairah', 'Fujairah', 3000, 7);

update public.settings set free_delivery_threshold_fils = 50000, contact_email = 'hello@solei.ae';

-- Main warehouse.
insert into public.stock_locations (name, kind, sells_online, is_default)
values ('Main stock', 'warehouse', true, true);
