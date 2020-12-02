import React from 'react'
import Icon from '../chrome/Icon'
import StatsChart from '../StatsChart'
import LabeledStats, { Stat } from './LabeledStats'

interface StatDiffItem {
  data: BooleanStats | StringStats | NumericStats
  title?: string
  type?: 'boolean' | 'numeric' | 'string'
}

export interface StatMeta {
  title: string
}

// boolean
export interface BooleanStats {
  // needed so we can index into the object using a string field name
  [key: string]: any
  type: 'boolean'
  true: number
  false: number
  count: number
  delta?: BooleanStats
}

// string
export interface StringStats {
  // needed so we can index into the object using a string field name
  [key: string]: any
  type: 'string'
  count: number
  maxLength: number
  minLength: number
  unique: number
  frequencies: {
    [key: string]: number
  }
  delta: StringStats
}

// numeric
export interface NumericStats {
  // needed so we can index into the object using a string field name
  [key: string]: any
  type: 'numeric'
  count: number
  max: number
  mean: number
  median: number
  min: number
  histogram: {
    bins: number[]
    frequencies: number[]
  }
  delta: NumericStats
}

interface StatDiffRowHeaderProps {
  title?: string
  type?: 'boolean' | 'numeric' | 'string'
}

const StatDiffRowHeader: React.FC<StatDiffRowHeaderProps> = (props) => {
  const {
    title,
    type
  } = props
  return (<div className='margin-bottom' style={{ display: 'flex', alignItems: 'center', height: 30 }}>
    {title && <div className='padding-right' style={{ color: 'black', fontWeight: 500, fontSize: 20 }}>{title}</div>}
    {type && <div className='padding-left'><Icon icon={type} size='sm' color='medium' /><span style={{ marginLeft: 6, fontSize: 14 }}>{type}</span></div>}
  </div>)
}

export const StatDiffItem: React.FC<StatDiffItem> = (props) => {
  const {
    data,
    title,
    type
  } = props

  if (!data || Object.keys(data).length === 0) {
    return <div className='margin' style={{ height: '100%', width: '100%', position: 'absolute' }}>
      <StatDiffRowHeader title={title} type={type}/>
      <div style={{ fontWeight: 600 }}>Column Does Not Exist in this Version</div>
    </div>
  }

  let statsList: Stat[] = []
  let chartName: string = ''
  const { delta } = data
  for (const [key, val] of Object.entries(data)) {
    switch (key) {
      case 'type':
      case 'delta':
        continue
      case 'histogram':
      case 'frequencies':
        chartName = key
        continue
      default:
        statsList.push({
          label: key,
          value: val,
          delta: delta && delta[key]
        })
    }
  }

  /**
   * boolean is a special case where we derive the frequencies from
   * the stat values themselves, rather than a frequencies field, so
   * we need to make sure we actually print a chart
   */
  if (data.type === 'boolean') {
    chartName = 'frequencies'
  }

  if (data.type === 'string' && chartName) {
    if (Object.keys(data.frequencies).length >= 200) {
      chartName = 'frequencies of 200 most seen entries'
    }
  }
  return <div className='stat-diff-item margin'>
    <StatDiffRowHeader title={title} type={type}/>
    <div className='margin-bottom'>
      <div className='label small uppercase margin-bottom'>Column Stats</div>
      <LabeledStats data={statsList} uppercase={false}/>
    </div>
    <div className='margin-bottom'>
      {chartName && <div className='label small uppercase margin-bottom'>{chartName}</div>}
      {chartName
        ? <StatsChart data={data} showStats={false}/>
        : <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>No chart available</div>
      }
    </div>
  </div>
}

export interface ColumnStats {
  left: NumericStats | StringStats | BooleanStats
  right: NumericStats | StringStats | BooleanStats
  meta: StatMeta
}

export interface StatDiffRowProps {
  data: ColumnStats
  last: boolean
}

export const StatDiffRow: React.FC<StatDiffRowProps> = ({ data, last }) => {
  const {
    left,
    right,
    meta
  } = data
  const { type } = right

  return (<tr style={{ verticalAlign: 'top', borderBottom: last ? 'none' : '1px solid #eee' }}>
    <td>
      <StatDiffItem data={left} title={meta && meta.title} type={type}/>
    </td>
    <td>
      <StatDiffItem data={right} />
    </td>
  </tr>)
}
