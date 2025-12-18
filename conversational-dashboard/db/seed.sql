-- Seed data for the database

-- Insert categories
INSERT INTO categories (name, description) VALUES
  ('Coffee', 'Coffee and cafe beverages'),
  ('Food', 'Restaurants and food delivery'),
  ('Shopping', 'Retail and online shopping'),
  ('Transport', 'Ride sharing and transportation'),
  ('Entertainment', 'Streaming services and entertainment'),
  ('Groceries', 'Supermarkets and grocery stores'),
  ('Utilities', 'Bills and utilities'),
  ('Healthcare', 'Medical and health services');

-- Insert departments
INSERT INTO departments (name, budget, location) VALUES
  ('Engineering', 500000.00, 'Building A'),
  ('Marketing', 200000.00, 'Building B'),
  ('Sales', 300000.00, 'Building B'),
  ('HR', 150000.00, 'Building C'),
  ('Finance', 250000.00, 'Building C'),
  ('Operations', 180000.00, 'Building A');

-- Insert users
INSERT INTO users (name, email, department_id, role, salary, hire_date) VALUES
  ('Leila Khan', 'leila.khan@company.com', 1, 'Senior Engineer', 95000.00, '2020-03-15'),
  ('Alex Chen', 'alex.chen@company.com', 1, 'Engineer', 85000.00, '2021-06-01'),
  ('Jordan Smith', 'jordan.smith@company.com', 2, 'Marketing Manager', 90000.00, '2019-08-20'),
  ('Taylor Brown', 'taylor.brown@company.com', 3, 'Sales Rep', 75000.00, '2022-01-10'),
  ('Sam Johnson', 'sam.johnson@company.com', 1, 'Junior Engineer', 70000.00, '2023-04-01'),
  ('Morgan Lee', 'morgan.lee@company.com', 4, 'HR Specialist', 65000.00, '2021-11-15'),
  ('Casey Davis', 'casey.davis@company.com', 5, 'Financial Analyst', 80000.00, '2020-09-05'),
  ('Riley Martinez', 'riley.martinez@company.com', 3, 'Sales Manager', 95000.00, '2018-05-12'),
  ('Quinn Taylor', 'quinn.taylor@company.com', 2, 'Content Creator', 68000.00, '2022-07-20'),
  ('Avery Wilson', 'avery.wilson@company.com', 6, 'Operations Lead', 88000.00, '2019-12-01');

-- Insert products
INSERT INTO products (name, category_id, price, stock_quantity, supplier) VALUES
  ('Premium Coffee Beans', 1, 24.99, 150, 'Coffee Co'),
  ('Organic Bananas', 6, 3.99, 200, 'Fresh Farms'),
  ('Wireless Mouse', 3, 29.99, 80, 'Tech Supply'),
  ('Notebook Set', 3, 12.99, 120, 'Office Depot'),
  ('Energy Drink Pack', 2, 18.99, 100, 'Beverage Inc'),
  ('Laptop Backpack', 3, 49.99, 60, 'Gear World'),
  ('Yoga Mat', 3, 34.99, 45, 'Fitness Plus'),
  ('Protein Bars Box', 2, 22.99, 90, 'Health Foods'),
  ('Desk Lamp', 3, 39.99, 55, 'Home Decor'),
  ('Water Bottle', 3, 19.99, 110, 'Hydration Co');

-- Insert transactions
INSERT INTO transactions (user_id, merchant_name, amount, category, payment_method, created_at) VALUES
  -- January 2025
  (1, 'Starbucks', 5.95, 'Coffee', 'credit_card', '2025-01-01 09:00:00'),
  (2, 'Amazon', 25.40, 'Shopping', 'credit_card', '2025-01-01 11:10:00'),
  (3, 'McDonalds', 8.25, 'Food', 'debit_card', '2025-01-02 08:15:00'),
  (4, 'Starbucks', 6.50, 'Coffee', 'credit_card', '2025-01-02 14:20:00'),
  (5, 'Uber', 18.75, 'Transport', 'credit_card', '2025-01-03 16:50:00'),
  (2, 'Amazon', 40.10, 'Shopping', 'credit_card', '2025-01-03 18:00:00'),
  (3, 'Local Cafe', 4.90, 'Coffee', 'cash', '2025-01-04 07:40:00'),
  (4, 'Target', 32.00, 'Shopping', 'debit_card', '2025-01-04 20:00:00'),
  (3, 'Starbucks', 5.25, 'Coffee', 'credit_card', '2025-01-05 10:10:00'),
  (2, 'Netflix', 15.99, 'Entertainment', 'credit_card', '2025-01-05 22:00:00'),

  -- More January data
  (1, 'Whole Foods', 45.60, 'Groceries', 'debit_card', '2025-01-06 17:30:00'),
  (5, 'Spotify', 10.99, 'Entertainment', 'credit_card', '2025-01-07 09:00:00'),
  (6, 'Chipotle', 12.50, 'Food', 'credit_card', '2025-01-07 12:30:00'),
  (7, 'Shell Gas Station', 55.00, 'Transport', 'debit_card', '2025-01-08 08:00:00'),
  (8, 'Starbucks', 7.25, 'Coffee', 'credit_card', '2025-01-08 10:15:00'),
  (9, 'Amazon', 89.99, 'Shopping', 'credit_card', '2025-01-09 15:45:00'),
  (10, 'Uber Eats', 28.50, 'Food', 'credit_card', '2025-01-09 19:20:00'),
  (1, 'CVS Pharmacy', 23.75, 'Healthcare', 'debit_card', '2025-01-10 11:00:00'),
  (2, 'Lyft', 16.30, 'Transport', 'credit_card', '2025-01-10 08:45:00'),
  (3, 'Trader Joes', 52.40, 'Groceries', 'debit_card', '2025-01-11 16:00:00'),

  -- More diverse data
  (4, 'Apple Store', 199.99, 'Shopping', 'credit_card', '2025-01-12 14:00:00'),
  (5, 'Panera Bread', 11.75, 'Food', 'credit_card', '2025-01-12 12:00:00'),
  (6, 'Starbucks', 6.45, 'Coffee', 'credit_card', '2025-01-13 09:30:00'),
  (7, 'Costco', 145.80, 'Groceries', 'debit_card', '2025-01-13 10:00:00'),
  (8, 'Disney+', 13.99, 'Entertainment', 'credit_card', '2025-01-14 20:00:00'),
  (9, 'Uber', 22.40, 'Transport', 'credit_card', '2025-01-14 18:30:00'),
  (10, 'Starbucks', 5.95, 'Coffee', 'credit_card', '2025-01-15 08:00:00'),
  (1, 'Best Buy', 299.99, 'Shopping', 'credit_card', '2025-01-15 13:00:00'),
  (2, 'Subway', 9.50, 'Food', 'debit_card', '2025-01-16 12:15:00'),
  (3, 'Amazon', 67.25, 'Shopping', 'credit_card', '2025-01-16 21:00:00');

-- Insert orders
INSERT INTO orders (user_id, total_amount, status, shipping_address, created_at, completed_at) VALUES
  (2, 89.97, 'completed', '123 Main St, City, State 12345', '2025-01-02 10:00:00', '2025-01-05 14:30:00'),
  (4, 149.95, 'completed', '456 Oak Ave, City, State 12345', '2025-01-03 15:20:00', '2025-01-07 16:00:00'),
  (1, 74.98, 'shipped', '789 Pine Rd, City, State 12345', '2025-01-05 09:15:00', NULL),
  (3, 199.99, 'processing', '321 Elm St, City, State 12345', '2025-01-08 11:30:00', NULL),
  (5, 44.97, 'completed', '654 Maple Dr, City, State 12345', '2025-01-10 14:45:00', '2025-01-14 10:00:00'),
  (7, 129.96, 'shipped', '987 Cedar Ln, City, State 12345', '2025-01-12 16:00:00', NULL),
  (9, 59.98, 'pending', '147 Birch Way, City, State 12345', '2025-01-14 13:20:00', NULL),
  (6, 89.99, 'completed', '258 Willow Ct, City, State 12345', '2025-01-15 10:30:00', '2025-01-17 09:00:00');

-- Insert order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
  -- Order 1
  (1, 3, 2, 29.99, 59.98),
  (1, 4, 1, 12.99, 12.99),
  (1, 10, 1, 19.99, 19.99),
  -- Order 2
  (2, 6, 1, 49.99, 49.99),
  (2, 7, 2, 34.99, 69.98),
  (2, 4, 1, 12.99, 12.99),
  -- Order 3
  (3, 1, 3, 24.99, 74.97),
  -- Order 4
  (4, 6, 2, 49.99, 99.98),
  (4, 9, 2, 39.99, 79.98),
  (4, 10, 1, 19.99, 19.99),
  -- Order 5
  (5, 8, 1, 22.99, 22.99),
  (5, 10, 1, 19.99, 19.99),
  -- Order 6
  (6, 7, 2, 34.99, 69.98),
  (6, 3, 2, 29.99, 59.98),
  -- Order 7
  (7, 1, 1, 24.99, 24.99),
  (7, 5, 1, 18.99, 18.99),
  (7, 10, 1, 19.99, 19.99),
  -- Order 8
  (8, 6, 1, 49.99, 49.99),
  (8, 9, 1, 39.99, 39.99);
