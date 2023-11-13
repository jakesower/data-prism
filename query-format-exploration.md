# Sample Query Formats

Consider queries that answer the following question:

> Give me the names and belly badges all of the bears that live in Care-a-Lot. Furthermore, please give me the names of any powers they have and the name of their best friend.

Assume the correct answer to this query is:

```JSON
[
  {
    "name": "Tenderheart Bear",
    "belly_badge": "red heart with pink outline",
    "power_names": ["Care Bear Stare"],
    "best_friend_name": null
  },
  {
    "name": "Cheer Bear",
    "belly_badge": "rainbow",
    "power_names": ["Care Bear Stare"],
    "best_friend_name": "Wish Bear"
  },
  {
    "name": "Wish Bear",
    "belly_badge": "shooting star",
    "power_names": ["Care Bear Stare", "Make a Wish"],
    "best_friend_name": "Cheer Bear"
  },
  {
    "name": "Smart Heart Bear",
    "belly_badge": "red apple with a small white heart-shaped shine",
    "power_names": [],
    "best_friend_name": null
  }
]
```

## SQL

One might obtain the information via SQL:

```SQL
SELECT
  bears.name,
  bears.belly_badge,
  powers.name AS power_name,
  best_friend_bears.name AS best_friend_name
FROM homes
  INNER JOIN bears ON bears.home_id = homes.id
  LEFT OUTER JOIN bears_powers ON bears.id = bears_powers.bear_id
  LEFT OUTER JOIN powers ON bears_powers.power_id = powers.id
  LEFT OUTER JOIN bears AS best_friend_bears ON bears.best_friend_id = best_friend_bears.id
WHERE
  homes.name = 'Care-a-Lot';
```

This would return something equivalent to this:

```JSON
[
  {
    "name": "Tenderheart Bear",
    "belly_badge": "red heart with pink outline",
    "power_name": "Care Bear Stare",
    "best_friend_name": null
  },
  {
    "name": "Cheer Bear",
    "belly_badge": "rainbow",
    "power_name": "Care Bear Stare",
    "best_friend_name": "Wish Bear"
  },
  {
    "name": "Wish Bear",
    "belly_badge": "shooting star",
    "power_name": "Care Bear Stare",
    "best_friend_name": "Cheer Bear"
  },
  {
    "name": "Wish Bear",
    "belly_badge": "shooting star",
    "power_name": "Make a Wish",
    "best_friend_name": "Cheer Bear"
  },
  {
    "name": "Smart Heart Bear",
    "belly_badge": "red apple with a small white heart-shaped shine",
    "power_name": null,
    "best_friend_name": null
  }
]
```

We have the data necessary to massage it into our preferred output format.

## JSON:API

Using JSON:API, we could make a request like this to an approprate server:

`http://example.xyz/homes?fields[bears]=name,belly_badge&fields[powers]=name&include=bears,bears.powers,bears.best_friend&filter[name]=Care-a-Lot`

That'd give us back something like:

```JSON
{
  "data": [
    {
      "type": "homes",
      "id": "1",
      "attributes": {
        "name": "Care-a-Lot"
      },
      "relationships": {
        "bears": {
          "data": [
            { "type": "bears", "id": "1" },
            { "type": "bears", "id": "2" },
            { "type": "bears", "id": "3" },
            { "type": "bears", "id": "5" }
          ]
        }
      }
    }
  ],
  "included": [
    {
      "type": "bears",
      "id": "1",
      "attributes": {
        "belly_badge": "red heart with pink outline",
        "name": "Tenderheart Bear",
      },
      "relationships": {
        "best_friend": {
          "data": null
        },
        "powers": {
          "data": [
            { "type": "powers", "id": "1" }
          ]
        }
      }
    },
    {
      "type": "bears",
      "id": "2",
      "attributes": {
        "belly_badge": "rainbow",
        "name": "Cheer Bear",
      },
      "relationships": {
        "best_friend": {
          "data": { "type": "bears", "id": "3" }
        },
        "powers": {
          "data": [
            { "type": "powers", "id": "1" }
          ]
        }
      }
    },
    {
      "type": "bears",
      "id": "3",
      "attributes": {
        "belly_badge": "shooting star",
        "name": "Wish Bear",
      },
      "relationships": {
        "best_friend": {
          "data": { "type": "bears", "id": "2" }
        },
        "powers": {
          "data": [
            { "type": "powers", "id": "1" },
            { "type": "powers", "id": "2" }
          ]
        }
      }
    },
    {
      "type": "bears",
      "id": "1",
      "attributes": {
        "belly_badge": "red apple with a small white heart-shaped shine",
        "name": "Smart Heart Bear",
      },
      "relationships": {
        "best_friend": {
          "data": null
        },
        "powers": {
          "data": []
        }
      }
    },
    {
      "type": "powers",
      "id": "1",
      "attributes": {
        "name": "Care Bear Stare"
      }
    },
    {
      "type": "powers",
      "id": "2",
      "attributes": {
        "name": "Make a Wish"
      }
    }
  ]
}
```

Once again we've been presented with all of the data necessary to construct our desired answer.

## Conclusion

These examples go to show a few things:

- Queries for the same thing can look very different
- The query results look equally different
- The query results have all of the information needed to construct the final result

A great deal of developer time is spent working with various stores. Creating queries and parsing the results is bread and butter work. In fact, it's a good project to take the JSON:API query (as encoded in the URL), turn it into SQL, then turn the result from the database back into a JSON:API response. This is useful work, given the different situations of using a powerful database and needing to get information over a wire.

That said, this kind of work is repetitive. There is a rainbow of offerings as far as stores go, each with their own niche, strengths, and weaknesses. Sometimes these stores require carefully tuned queries that maximize what the stores have to bring to bear. However, there are common use cases that are not so sophisticated and can be expressed with queries represented in JSON rather than URLs, SQL strings, Mongo queries, GraphQL strings, and on and on.

# Data Prism

Data Prism aims to standardize a method of sending uniform queries and receiving uniform responses across stores. It is a standard first with various implementations being useful, but secondary. There are three primary data structures that are used: schemas, queries, and results. Stores also have configs, but they are specific to their store and are not standardized.

## Schema

A schema describes resources by their properties and relationships. The syntax closely resembles that of JSON Schema, but with somewhat more structure. Keeping with the examples above, a schema that would fit the results might look like this:

```JSON
{
  "resources": {
    "bears": {
      "idField": "id",
      "properties": {
        "name": {
          "type": "string"
        },
        "year_introduced": {
          "description": "The year of the first time the bear was used in any format.",
          "type": "integer"
        },
        "belly_badge": {
          "type": "string"
        },
        "fur_color": {
          "type": "string"
        }
      },
      "relationships": {
        "home": {
          "cardinality": "one",
          "resource": "homes",
          "inverse": "residents"
        },
        "powers": {
          "cardinality": "many",
          "resource": "powers",
          "inverse": "wielders"
        },
        "best_friend": {
          "cardinality": "one",
          "resource": "bears",
          "inverse": "best_friend"
        }
      }
    },
    "homes": {
      "idField": "id",
      "properties": {
        "name": {
          "type": "string"
        },
        "location": {
          "type": "string"
        },
        "caring_meter": {
          "type": "number"
        },
        "is_in_clouds": {
          "type": "boolean"
        }
      },
      "relationships": {
        "residents": {
          "cardinality": "many",
          "resource": "bears",
          "inverse": "home"
        }
      }
    },
    "powers": {
      "idField": "powerId",
      "properties": {
        "name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "type": {
          "type": "string"
        },
        "power_level": {
          "title": "Power Level",
          "description": "A number from 0 to 100 describing how strong a power is.",
          "type": "number",
          "minimum": 0,
          "maximum": 100
        }
      },
      "relationships": {
        "wielders": {
          "resource": "bears",
          "cardinality": "many",
          "inverse": "powers"
        }
      }
    }
  }
}
```

The schema is written in JSON and has a [definition](https://raw.githubusercontent.com/jakesower/data-prism/main/schemas/data-prism-schema.1.0.schema.json) file for it, which is written in JSON schema. The schema is a core component because of its extrapolative quality. Queries are dependent on it because of subqueries and validation. Furthermore, many other parts of a program can tap into the schema. For example, I have used it to provide a web form that automatically populates labels, help text, and extrapolates the best inputs for capturing data automatically (e.g., an `integer` data type gets a `number` input).

The fact that that files are in JSON make for ideal data contracts between various systems.

## Query

This is the part that I'm trying to nail down. Queries are exactly what they sound like: ways of requesting data from a store. They have to be aligned with queries, and the results should flow from them in as straightforward a manner as possible. That said, there are a number of ways of writing them as well as an extent of capabilities built directly into the queries. I've tried to lay out a few approaches.

Minimal query features:

- Able to query for any data, including nested data
- Expressed in JSON
- Supports the same features as JSON:API: filters, nested data, sorting, limit/offset, and sparse fields.

Base query format:

```JSON
{
  "type": "homes",
  "select": [
    "id",
    "name",
    {
      "residents": {
        "select": [
          "name",
          {
            "bellyBadge": "belly_badge",
            "powers": {
              "select": ["name"]
            }
          }
        ]
      }
    }
  ],
  "where": {
    "name": "Care-a-Lot"
  }
}
```

That query targets the right things in its `select` clause. Fields are either named or mapped from the underlying data into a desired result. In this case, `belly_badge` is transformed into the camel case `bellyBadge`. The remaining items in the `select` clause are subqueries. They traverse the schema (homes have a `residents` relationship that refers to `bears`), and repeat the logic of selecting fields. Subqueries have all the powers of root queries. Finally, the `where` clause checks for equality on the name of the home as a filter.

## Results

Let's skip ahead to see what the results should look like. In the previous examples we saw SQL return a table-like result, whereas JSON:API returned two arrays of resource objects. Data Prism favors trees. A query can either return a single tree or an array of trees. An example that may be the result of the previous query:

```JSON
{
  "id": "1",
  "name": "Care-a-Lot",
  "bears": [
    {
      "name": "Tenderheart Bear",
      "bellyBadge": "red heart with pink outline",
      "powers": [
        { "name": "Care Bear Stare" }
      ],
      "best_friend": null
    },
    {
      "name": "Cheer Bear",
      "bellyBadge": "rainbow",
      "powers": [
        { "name": "Care Bear Stare" }
      ]
      "best_friend": {
        "name": "Wish Bear"
      }
    },
    {
      "name": "Wish Bear",
      "bellyBadge": "shooting star",
      "powers": [
        { "name": "Care Bear Stare" },
        { "name": "Make a Wish" }
      ],
      "best_friend": {
        "name": "Wish Bear"
      }
    },
    {
      "name": "Smart Heart Bear",
      "bellyBadge": "red apple with a small white heart-shaped shine",
      "powers": [],
      "best_friend": null
    }
  ]
}
```

I selected trees because I enjoy working with them at the moment that I use the data. I have direct access to the arrays, nested objects, and other data structures in a concrete way. I don't have to worry about traversing anything abstract (like a table with semi-duplicated results, or figuring out how traverse a JSON:API object with side-loaded resources). Instead, that kind of necessary logic is left to the store. I get exactly what I want.

## Uses

I have personally found this approach to be useful for testing. I can use a test data set and use dependency injection to fill my application with known data, perform whatever tests I wish, and rely on the knowledge that those queries that work on my test store will also work on the real store without modification. This is opposed to, say, making `axios` calls at the top of each component to fetch the necessary data. No dummy server required!

With that in mind, it's also been helpful to have a strong test suite for testing new stores that get written. I can develop a store (with builders for those `axios` API calls) and have dozens of pre-made tests to help me develop with confidence.

It keeps the query construction from the various implementations. I'd imagine it'd be useful for migrating from one store to another as a result of that.

## Conclusion

That's the high level overview of the project. I've included some more ideas as a postscript, but the above are the most important and the bits I'd be most grateful for feedback on. Thank you for taking the time to read this.

## Postscript: Expressions

There are things that a query language can offer beyond field selection and subqueries.

- Filtering with comparative logic
- Defaulting values
- Aggregating or grouping fields on to-many relationships

One of the approaches I've considered is the definition and use of expressions. Consider the above query, except with the following change:

```JSON
{
  "where": {
    "year_introduced": { "$gt": 1990 }
  }
}
```

This uses a mongodb-like expression that means "give me bears who were introduced after 1990." The fact that there's already some nomenclature and roughly associated meaning for these concepts is extremely helpful.

Expressions can be used in other places as well. I'll also introduce dot notation.

```JSON
{
  "type": "homes",
  "select": [
    "name",
    {
      "oldestResidentYear": { "$min": "residents.year_introduced" }
    }
  ]
}
```

Might return:

```JSON
[
  { "name": "Care-a-Lot", "oldestResidentYear": 1984 },
  { "name": "Forest of Feelings": "oldestResidentYear": 2005 }
]
```

Here we can see that `residents.year_introduced` traverses the related resources without performing a direct subquery. This can be extended using something like a flat map format: `residents.best_friend.year_introduced` or even `residents.$.powers.power_level`.

I think it's fair to assume you see what applications this might have. It brings the level of power shy of SQL, but sufficient for most common queries that would be useful in, say, a web application. Anything fancier could collect the needed fields and perform whatever logic on them.
