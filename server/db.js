const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://digtpiftmkwphubazdrq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZ3RwaWZ0bWt3cGh1YmF6ZHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDU5MDIsImV4cCI6MjA4NzM4MTkwMn0.vS1aeLuuk18qBcJq0hqk2ShcxWCYDhDw0vYyawYE4kM'
);

module.exports = supabase;
