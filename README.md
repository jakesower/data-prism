# Data Prism

Data Prism is a library for dealing with structured graphs. These can be databases, APIs, caches, or anything else that fits these criteria:

- The data can be described by a schema of resources
- Resources have properties as well as relationships to other resources

Data Prism is highly aligned with its data structures. Data flow from queries, which in turn depend on schemas. Having an understanding of these concepts is critical to using the libraries well.

## Components

### Store

A store is a repository of data that follows a schema that is provided to it. Stores include SQL databases, graph databases, APIs, among other data structuring systems.

### Schema

A schema describes the data within a store. It lists resources as with their properties and relationships. It is written in or is serializable to JSON. An example of a couple properties:

```json
{
  "properties": {
    "arrival_time": {
      "type": "date-time"
    },
    "class": {
      "type": "string",
      "enum": ["first", "coach"]
    },
    "ticket_price": {
      "type": "number"
    }
  }
}
```

Types are extensible, but stores should all support the following basic types:

- boolean
- date-time
- integer
- null
- number
- string

These types can be used by stores to automatically set up such things as sorting, casting, and filtering. Types beyond these are valid, but will have to have more features implemented by hand.

Schema relationships are used to connect various resources. An example:

```json
{
  "relationships": {
    "train": {
      "resource": "trains",
      "cardinality": "one",
      "inverse": "trips"
    }
  }
}
```

Relationships are powerful tools that can be highly leveraged by stores to run nested or projected queries, among other uses.

A schema of schemas can be found in [./schemas](./schemas) and examples can be found in [./examples](./examples).

### Query

Queries are the most written type within a typical Data Prism application. Stores accept queries and produce results based on the contents of the store. The various store types handle queries differently (they may walk a memory tree, produce SQL, hit an API, or other such things). However, the structure of a query and its results are uniform across the different store types. Custom stores need to abide by the same rules.

Example queries:

```json
{
  "type": "trips",
  "select" {
    "arrives_at": "arrival_time",
    "trains": {
      "select": {
        "name": "name"
      }
    }
  }
}
```

This might produce a result like:

```json
[
  {
    "arrives_at": "1899-10-01T22:00:00",
    "trains": {
      "name": "Orient Express"
    }
  }
]
```

Queries must match the schema of the store. The result and query structure correspond, but queries can take in other parameters like filters, sorting, and pagination.

For example:

```json
{
  "type": "trips",
  "select" {
    "arrives_at": "arrival_time",
    "trains": {
      "select": {
        "name": "name"
      }
    }
  },
  "where": {
    "class": "first"
  },
  "order": [
    { "arrival_time": "asc" }
  ]
  "limit": 1,
  "offset": 5
}
```

## Possible Upcoming Features

Many arguments can make use of expressions, which are described later.

Queries also have the ability project and do limited aggregation.

```json
{
  "type": "trains",
  "select": {
    "name": "name",
    "trip_count": { "$count": "trips" },
    "mean_cost": { "$mean": "trips.$.cost" },
    "owner": "company.name",
    "company": "company"
  }
}
```

Produces:

```json
[
  {
    "name": "Orient Express",
    "trip_count": 50,
    "mean_cost": 193.33,
    "owner": "Compagnie Internationale des Wagons-Lits",
    "company": { "type": "companies", "id": "123" }
  }
]
```

This example shows the use of a couple of aggregating expressions (`$count` and `$mean`) as well as the use of dot notation for nested fields (`trips.$.cost` and `company.name`). Paired with a schema and proper expression evaluators, these can make for expressive queries. Aggregating expressions are about as extensive as those implemented by SQL databases. More complex manipulations should be done programatically.

Note that queries are implemented as JSON objects, rather than strings. This makes them easier to compose, pick apart, and otherwise manipulate than string-based query languages such as SQL and GraphQL.

## Current Project Status

As of July 2023, a `Memory Store` is fully implemented with a `SQL Store` and `API Store` in progress.
