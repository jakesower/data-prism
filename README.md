# Data Prism

> **⚠️ DEPRECATED: This package has been renamed to `spectragraph`**
>
> This repository is no longer maintained. Please migrate to the new package:
> - **New repository:** [spectragraph](https://github.com/jakesower/spectragraph)
> - **New npm packages:** `@spectragraph/*` instead of `@data-prism/*`
>
> All future development will happen in the spectragraph repository.

A unified, expressive query language for multiple data sources. Query databases, APIs, and in-memory data with the same syntax, automatic relationship linking, and powerful expressions.

## Quick Example

```javascript
// Same query works across different data sources
const result = await store.query({
	type: "users",
	select: [
		"name",
		"email",
		{
			posts: [
				"title",
				"createdAt",
				{
					comments: [
						"content",
						{
							author: ["name"],
						},
					],
				},
			],
		},
	],
	where: { active: true },
	limit: 10,
});

// Works with: PostgreSQL, SQLite, in-memory data, REST APIs
// Handles relationships automatically with request optimization
```

## Installation

```bash
npm install @data-prism/memory-store
# or choose your store: postgres-store, sqlite-store, etc.
```

## Basic Usage

```javascript
import { createMemoryStore } from "@data-prism/memory-store";

// Define your data schema
const schema = {
	resources: {
		users: {
			attributes: {
				name: { type: "string" },
				email: { type: "string" },
			},
			relationships: {
				posts: { type: "posts", cardinality: "hasMany" },
			},
		},
		posts: {
			attributes: {
				title: { type: "string" },
				content: { type: "string" },
			},
			relationships: {
				author: { type: "users", cardinality: "belongsTo" },
			},
		},
	},
};

// Create store with initial data
const store = createMemoryStore(schema, {
	initialData: {
		users: {
			1: {
				id: "1",
				type: "users",
				attributes: { name: "Alice", email: "alice@example.com" },
				relationships: { posts: [{ type: "posts", id: "1" }] },
			},
		},
		posts: {
			1: {
				id: "1",
				type: "posts",
				attributes: { title: "Hello World", content: "My first post" },
				relationships: { author: { type: "users", id: "1" } },
			},
		},
	},
});

// Query with expressions
const analytics = await store.query({
	type: "users",
	select: {
		name: "name",
		postCount: { $count: "posts" },
		avgPostLength: { $avg: "posts.$.content.length" },
	},
});

console.log(analytics);
// [{ name: 'Alice', postCount: 1, avgPostLength: 13 }]
```

## Use Cases

**Backend Development**

- **Database Abstraction** - Switch between PostgreSQL, SQLite, or in-memory stores without changing queries
- **API Integration** - Combine data from multiple services with unified query syntax
- **Microservice Data** - Query across service boundaries with automatic relationship resolution

**Frontend Development**

- **Multi-API Coordination** - Fetch related data from multiple endpoints in one query
- **Request Optimization** - Minimize API calls with intelligent batching and caching
- **Data Transformation** - Apply computations and aggregations client-side

**Data Analysis**

- **Expression-Powered Queries** - Built-in aggregations, computations, and transformations
- **Cross-Store Analytics** - Same analytical queries work on any data source
- **Dynamic Querying** - Build queries programmatically for dashboards and reports

**Custom Store Development**

- **Store Builder Toolkit** - Create stores for any data source using `@data-prism/core`
- **Unified Interface** - Implement once, compatible with entire Data Prism ecosystem
- **Query Processing** - Built-in validation, normalization, and relationship handling

## Available Stores

| Store                                                     | Use Case                             | Status    |
| --------------------------------------------------------- | ------------------------------------ | --------- |
| **[@data-prism/memory-store](packages/memory-store)**     | In-memory data, testing, prototyping | ✅ Stable |
| **[@data-prism/postgres-store](packages/postgres-store)** | PostgreSQL databases                 | ✅ Stable |
| **[@data-prism/sqlite-store](packages/sqlite-store)**     | SQLite databases                     | ✅ Stable |

## Advanced Query Examples

### Filtering and Sorting

```javascript
{
  type: "posts",
  select: ["title", "createdAt"],
  where: {
    published: true,
    createdAt: { $gte: "2024-01-01" }
  },
  order: [{ createdAt: "desc" }],
  limit: 5
}
```

### Complex Expressions

```javascript
{
  type: "companies",
  select: {
    name: "name",
    avgEmployeeSalary: { $avg: "departments.$.employees.$.salary" },
    topDepartment: {
      $first: {
        $orderBy: ["departments", { $desc: { $avg: "employees.$.performance" } }]
      }
    }
  }
}
```

### Cross-Store Data Composition

```javascript
// Same query pattern works across different store types
{
  type: "users",
  select: ["name", {
    posts: ["title", "createdAt", {
      comments: {
        select: ["content"],
        limit: 3
      }
    }]
  }],
  where: { active: true }
}
```

## Documentation

- **[Query Guide](docs/query.md)** - Complete query language reference
- **[Schema Guide](docs/schema.md)** - Defining data structures and relationships
- **[Expression Reference](docs/expressions.md)** - Built-in functions and operators
- **[Store Creation Guide](docs/store-creation.md)** - Building custom stores
- **[API Reference](docs/api.md)** - Full API documentation

## Why Data Prism?

**Instead of store-specific query languages:**

```sql
-- PostgreSQL
SELECT u.name, p.title, c.content
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON p.id = c.post_id
WHERE u.active = true;
```

**Write once, run anywhere:**

```javascript
// Same query works on PostgreSQL, SQLite, in-memory, or API stores
const result = await store.query({
	type: "users",
	select: [
		"name",
		{
			posts: [
				"title",
				{
					comments: ["content"],
				},
			],
		},
	],
	where: { active: true },
});
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT © [Jake Sower](https://github.com/jakesower)
