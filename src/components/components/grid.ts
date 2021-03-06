import xs, { Stream } from 'xstream';
import { div, span, strong, table, td, th, tr, button, VNode } from "@cycle/dom";
import { Maybe } from '../../lib/monads/maybe';
import { DataColumn, DataSource, StateModifier } from "../../types";
import dataTypes from "../../lib/data-types";
import { ascend, descend, sortBy, merge, pipe, clamp } from "../../lib/utils";

interface LocalState {
  page: number,
  sorting: { col: Maybe<number>, dir: "asc" | "desc"},
}

interface Props {
  source: Maybe<DataSource>,
}

interface State extends LocalState, Props {}


interface Output {
  DOM: Stream<VNode | null>
}

const perPage = 25;

const initState: LocalState = {
  page: 1,
  sorting: {col: Maybe.Nothing<number>(), dir: "asc"},
};

export default function main(cycleSources: {props: Stream<Props>, DOM: any}): Output {
  const props$: Stream<Props> = cycleSources.props.startWith({source: Maybe.Nothing<DataSource>()});

  const { firstPage$, prevPage$, nextPage$, lastPage$, columnSort$ } = intent({ DOM: cycleSources.DOM });
  const pageChanger = (action$: Stream<any>, pageFn: (page: number) => number): StateModifier<State> => {
    return xs.combine<Stream<any>, Props>(action$, props$)
      .map(([_, props]) => state => ({ ...state,
        page: clamp(1, props.source.map(numPages).withDefault(1), pageFn(state.page))
      }));
  };

  const stateModifiers$: StateModifier<LocalState> =
    xs.merge(
      pageChanger(firstPage$, _ => 1),
      pageChanger(prevPage$, p => p-1),
      pageChanger(nextPage$, p => p+1),
      pageChanger(lastPage$, _ => Infinity),
      columnSort$.map(nextCol => state => {
        const { col, dir } = state.sorting;
        const nextDir = (col.hasValue(nextCol) && dir === 'asc') ? 'desc' : 'asc';
        return { ...state, sorting: { col: Maybe.of(nextCol), dir: nextDir }};
      }),
    );

  const localState$ = stateModifiers$.fold((state, fn) => fn(state), initState);
  const state$ = xs.combine<Props, LocalState>(props$, localState$).map(([a,b]) => merge(a,b));

  return {
    DOM: state$.map(view),
  }
}

function intent(cycleSources): {[k in string]: Stream<any>} {
  const { DOM } = cycleSources;
  const getColumn = ev => ev.path.find(e => e.dataset && e.dataset.column != undefined).dataset.column;
  return {
    firstPage$: DOM.select(".first-page").events("click"),
    prevPage$: DOM.select(".prev-page").events("click"),
    nextPage$: DOM.select(".next-page").events("click"),
    lastPage$: DOM.select(".last-page").events("click"),
    columnSort$: DOM.select("th").events("click").map(getColumn),
  };
}

// TODO: sort by type (numbers and not just strings)
const view = (state: State) => {
  const source = state.source.withDefault(null);
  if (source === null || source.empty()) return null;

  const { headers } = source;
  const { sorting } = state;

  const records = sorting.col.map(sortColNum => {
    const sortCol: DataColumn = source.columns[sortColNum] || source.columns[0];
    const numericSort = sortCol.hasType(dataTypes.Number);
    const getCell = (rec: string[]): string => rec[sortColNum];
    const sorter = sorting.dir === "asc" ? ascend : descend;

    const sortPipe = numericSort ?
      sorter(pipe([getCell, v => dataTypes.Number.cast(v)])) :
      sorter(getCell);

    return sortBy(sortPipe, source.records) as string[][];
  }).withDefault(source.records);

  if(records.length === 0) return div({}, "");

  const toCells = r => r.map(datum => td({}, datum));
  const toRows = rs => rs.map(record => tr({}, toCells(record)));
  const numPages = Math.ceil(records.length / perPage);
  const page = clamp(1, numPages, state.page);
  const recordsOnPage = records.slice((page - 1) * perPage, page*perPage);

  const gridHeader = tr({}, headers.map((c, idx) => {
    const activeSort = sorting.col.hasValue(idx) ? sorting.dir : null;

    return th(
      { class: {
          asc: activeSort === "asc",
          desc: activeSort === "desc",
          sortable: true
        },
        dataset: { column: idx.toString() }
      },
      [ span({attrs: {class: "header"}}, c),
        span({attrs: {class: "desc arrow"}}, "▼"),
        span({attrs: {class: "asc arrow"}}, "▲"),
      ]
    );
  }));


  return div({}, [
    div({class: {"page-controls": true}}, [
      button({ class: { "first-page": true, disabled: page === 1 }}, "<<"),
      button({ class: { "prev-page": true, disabled: page === 1 }}, "<"),
      strong({class: {"button": true}}, `${page} / ${numPages}`),
      button({ class: { "next-page": true, disabled: page === numPages }}, ">"),
      button({ class: { "last-page": true, disabled: page === numPages }}, ">>"),
      // a({
      //   class: {button: true},
      //   on: {click: [exportCsv, source]}
      // }, "Export")
    ]),

    table({}, [gridHeader].concat(toRows(recordsOnPage))),
  ])
}


function numPages(source: DataSource | null) {
  return (source === null) ? 0 : Math.ceil(source.numRecords / perPage);
}


// // Technically a side effect; should possibly be moved. Where?
// function exportCsv(source) {
//   stringify(R.prepend(source.headers, source.records), (err, output) => {
//     const blob = new Blob([output], {type: "text/csv"});
//     FileSaver.saveAs(blob, "data-prism.csv");
//   });
// }


// module.exports = { Action, init, update, view };
