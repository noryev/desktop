import { Action, AnyAction } from 'redux'
import { push } from 'connected-react-router'

import { CALL_API, ApiAction, ApiActionThunk, chainSuccess } from '../store/api'
import { SelectedComponent } from '../models/store'
import { actionWithPagination } from '../utils/pagination'
import { openToast, setImportFileDetails } from './ui'
import { setSaveComplete, resetMutationsDataset, resetMutationsStatus } from './mutations'
import { setWorkingDataset, setSelectedListItem, setActiveTab, clearSelection } from './selections'
import {
  mapDataset,
  mapRecord,
  mapVersionInfo,
  mapStatus,
  mapBody,
  mapHistory
} from './mappingFuncs'
import { getActionType } from '../utils/actionType'
import { datasetConvertStringToScriptBytes } from '../utils/datasetConvertStringToScriptBytes'

import { CLEAR_DATASET_HEAD } from '../reducers/commitDetail'
import Dataset from '../models/dataset'

import { pathToHistory } from '../paths'

const pageSizeDefault = 100
export const bodyPageSizeDefault = 50

const DEFAULT_SELECTED_COMPONENT = 'body'

export function pingApi (): ApiActionThunk {
  return async (dispatch) => {
    const pingAction: ApiAction = {
      type: 'health',
      [CALL_API]: {
        endpoint: 'health',
        method: 'GET',
        map: mapRecord
      }
    }
    return dispatch(pingAction)
  }
}

// fetchWorkingDatasetDetails grabs the working dataset status, and history
export function fetchWorkingDatasetDetails (username: string, name: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const whenOk = chainSuccess(dispatch, getState)
    let response: AnyAction
    response = await fetchWorkingDataset(username, name)(dispatch, getState)
    // if the response returned in error, check the error
    // if it's 422, it means the dataset exists, it's just not linked to the filesystem
    // we still need the working dataset because it contains the history
    if (getActionType(response) === 'failure') {
      if (response.payload.err.code !== 422) {
        return response
      }
      response = await fetchWorkingDataset(username, name)(dispatch, getState)
    }
    if (response.payload.data.fsiPath) {
      response = await whenOk(fetchWorkingStatus(username, name))(response)
    }
    response = await whenOk(fetchBody(username, name, -1))(response)
    response = await whenOk(fetchStats(username, name))(response)
    response = await whenOk(fetchHistory(username, name, -1))(response)

    return response
  }
}

export function fetchModifiedComponents (username: string, name: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const { workingDataset } = getState()
    const { path } = workingDataset

    let response: Action

    const resetComponents = {
      type: 'resetComponents',
      [CALL_API]: {
        endpoint: '',
        method: 'GET',
        segments: {
          peername: username,
          name
        },
        map: mapDataset
      }
    }
    response = await dispatch(resetComponents)

    const resetBody = {
      type: 'resetBody',
      [CALL_API]: {
        endpoint: 'body',
        method: 'GET',
        pageInfo: {
          page: 1,
          pageSize: bodyPageSizeDefault
        },
        segments: {
          peername: username,
          name,
          path
        },
        map: mapDataset
      }
    }
    response = await dispatch(resetBody)

    return response
  }
}

// to invalidate pagination, set page to -1
export function fetchMyDatasets (page: number = 1, pageSize: number = pageSizeDefault): ApiActionThunk {
  return async (dispatch, getState) => {
    const state = getState()
    const { page: confirmedPage, doNotFetch } = actionWithPagination(page, state.myDatasets.pageInfo)

    // we need to emit a 'success' type, or our chainSuccess functions will fail
    if (doNotFetch) return new Promise(resolve => resolve({ type: 'SUCCESS' }))

    const listAction: ApiAction = {
      type: 'list',
      [CALL_API]: {
        endpoint: 'list',
        method: 'GET',
        pageInfo: {
          page: confirmedPage,
          pageSize
        },
        map: mapVersionInfo
      }
    }

    return dispatch(listAction)
  }
}

export function fetchWorkingDataset (username: string, name: string): ApiActionThunk {
  return async (dispatch) => {
    if (username === '' || name === '') {
      return Promise.reject(new Error('no peername or name selected'))
    }

    const action = {
      type: 'dataset',
      [CALL_API]: {
        endpoint: '',
        method: 'GET',
        segments: {
          peername: username,
          name
        },
        map: mapDataset
      }
    }
    return dispatch(action)
  }
}

export function fetchCommitDetail (username: string, name: string, path: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const whenOk = chainSuccess(dispatch, getState)
    let response: Action

    response = await fetchCommitDataset(username, name, path)(dispatch, getState)
    response = await whenOk(fetchCommitStatus(username, name, path))(response)
    response = await whenOk(fetchCommitBody(username, name, path, -1))(response)
    response = await whenOk(fetchCommitStats(username, name, path))(response)

    return response
  }
}

export function fetchCommitDataset (username: string, name: string, path: string): ApiActionThunk {
  return async (dispatch) => {
    if (path === '') {
      return dispatch({
        type: CLEAR_DATASET_HEAD,
        username,
        name
      })
    }

    const response = await dispatch({
      type: 'commitdataset',
      [CALL_API]: {
        endpoint: '',
        method: 'GET',
        segments: {
          username,
          name,
          path
        },
        map: mapDataset
      }
    })

    return response
  }
}

export function fetchCommitStatus (username: string, name: string, path: string): ApiActionThunk {
  return async (dispatch) => {
    if (path === '') {
      return dispatch({
        type: CLEAR_DATASET_HEAD,
        username,
        name
      })
    }

    const response = await dispatch({
      type: 'commitstatus',
      [CALL_API]: {
        endpoint: 'whatchanged',
        method: 'GET',
        segments: {
          username,
          name,
          path
        },
        map: mapStatus
      }
    })

    return response
  }
}

// to invalidate pagination, set page to -1
export function fetchHistory (username: string, name: string, page: number = 1, pageSize: number = pageSizeDefault): ApiActionThunk {
  return async (dispatch, getState) => {
    const state = getState()

    const { page: confirmedPage, doNotFetch } = actionWithPagination(page, state.workingDataset.history.pageInfo)

    // we need to emit a 'success' type, or our chainSuccess functions will fail
    if (doNotFetch) return new Promise(resolve => resolve({ type: 'SUCCESS' }))

    const action = {
      type: 'history',
      [CALL_API]: {
        endpoint: 'history',
        method: 'GET',
        segments: {
          username,
          name
        },
        pageInfo: {
          page: confirmedPage,
          pageSize
        },
        map: mapHistory
      }
    }

    return dispatch(action)
  }
}

export function fetchWorkingStatus (username: string, name: string): ApiActionThunk {
  return async (dispatch) => {
    if (username === '' || name === '') {
      return Promise.reject(new Error('no peername or name selected'))
    }
    const action = {
      type: 'status',
      [CALL_API]: {
        endpoint: 'status',
        method: 'GET',
        segments: {
          username,
          name
        },
        map: mapStatus
      }
    }

    return dispatch(action)
  }
}

// to invalidate pagination, set page to -1
export function fetchBody (username: string, name: string, page: number = 1, pageSize: number = bodyPageSizeDefault): ApiActionThunk {
  return async (dispatch, getState) => {
    const { workingDataset } = getState()

    const { page: confirmedPage, doNotFetch } = actionWithPagination(page, workingDataset.components.body.pageInfo)

    // we need to emit a 'success' type, or our chainSuccess functions will fail
    if (doNotFetch) return new Promise(resolve => resolve({ type: 'SUCCESS' }))

    const action = {
      type: 'body',
      [CALL_API]: {
        endpoint: 'body',
        method: 'GET',
        pageInfo: {
          page: confirmedPage,
          pageSize
        },
        segments: {
          username,
          name
        },
        map: mapBody
      }
    }

    return dispatch(action)
  }
}

// to invalidate pagination, set page to -1
export function fetchCommitBody (username: string, name: string, path: string, page: number = 1, pageSize: number = bodyPageSizeDefault): ApiActionThunk {
  return async (dispatch, getState) => {
    const { commitDetails } = getState()

    if (path === '') {
      return dispatch({
        type: CLEAR_DATASET_HEAD,
        username,
        name
      })
    }

    const { page: confirmedPage, doNotFetch } = actionWithPagination(page, commitDetails.components.body.pageInfo)

    // we need to emit a 'success' type, or our chainSuccess functions will fail
    if (doNotFetch) return new Promise(resolve => resolve({ type: 'SUCCESS' }))

    const action = {
      type: 'commitBody',
      [CALL_API]: {
        endpoint: 'body',
        method: 'GET',
        pageInfo: {
          page: confirmedPage,
          pageSize
        },
        segments: {
          username,
          name,
          path
        },
        map: mapBody
      }
    }
    return dispatch(action)
  }
}

export function fetchStats (username: string, name: string):
ApiActionThunk {
  return async (dispatch) => {
    const response = await dispatch({
      type: 'stats',
      [CALL_API]: {
        endpoint: 'stats',
        method: 'GET',
        segments: {
          username,
          name
        }
      }
    })

    return response
  }
}

export function fetchCommitStats (username: string, name: string, path: string):
ApiActionThunk {
  return async (dispatch) => {
    if (path === '') {
      return dispatch({
        type: CLEAR_DATASET_HEAD,
        username,
        name
      })
    }

    const response = await dispatch({
      type: 'commitstats',
      [CALL_API]: {
        endpoint: 'stats',
        method: 'GET',
        segments: {
          username,
          name,
          path
        }
      }
    })

    return response
  }
}

export function saveWorkingDataset (username: string, name: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const { workingDataset, mutations } = getState()
    const { title, message } = mutations.save.value
    let body: Dataset
    const commit = { title, message }
    if (workingDataset.fsiPath) {
      body = {
        commit
      }
    } else {
      body = {
        ...mutations.dataset.value,
        commit
      }
    }

    const action = {
      type: 'save',
      [CALL_API]: {
        endpoint: 'save',
        method: 'POST',
        segments: {
          username,
          name
        },
        body: datasetConvertStringToScriptBytes(body)
      }
    }

    return dispatch(action)
  }
}

export function saveWorkingDatasetAndFetch (username: string, name: string): ApiActionThunk {
  return async (dispatch, getState) => {
    let path: string

    return saveWorkingDataset(username, name)(dispatch, getState)
      .then(async (response) => {
        if (getActionType(response) === 'failure') throw response
        path = response.payload.data.path
        response = await fetchWorkingDatasetDetails(username, name)(dispatch, getState)
        return response
      })
      .then((response) => {
        if (getActionType(response) === 'success') {
          dispatch(setSaveComplete())
          dispatch(openToast('success', 'commit', 'commit success!'))
          dispatch(push(pathToHistory(username, name, path)))
        }
        return response
      })
      .catch((action) => {
        dispatch(setSaveComplete(action.payload.err.message))
        dispatch(openToast('error', 'commit', action.payload.err.message))
        return action
      })
  }
}

export function addDataset (username: string, name: string): ApiActionThunk {
  return async (dispatch) => {
    const action = {
      type: 'add',
      [CALL_API]: {
        endpoint: 'add',
        method: 'POST',
        segments: {
          username,
          name
        },
        map: mapDataset
      }
    }
    return dispatch(action)
  }
}

export function addDatasetAndFetch (username: string, name: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const whenOk = chainSuccess(dispatch, getState)
    let response: Action

    try {
      response = await addDataset(username, name)(dispatch, getState)
      // reset pagination
      response = await whenOk(fetchMyDatasets(-1))(response)
      dispatch(push(pathToHistory(username, name, '')))
    } catch (action) {
      dispatch(openToast('error', 'add', action.payload.err.message))
      throw action
    }
    return response
  }
}

export function publishDataset (username: string, name: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const whenOk = chainSuccess(dispatch, getState)
    const action = {
      type: 'publish',
      [CALL_API]: {
        endpoint: 'publish',
        method: 'POST',
        segments: {
          username,
          name
        }
      }
    }

    try {
      let response: Action
      response = await dispatch(action)
      await whenOk(fetchWorkingDataset(username, name))(response)
    } catch (action) {
      throw action
    }
    // return response
    return dispatch(openToast('success', 'publish', 'dataset published'))
  }
}

export function unpublishDataset (username: string, name: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const whenOk = chainSuccess(dispatch, getState)
    const action = {
      type: 'unpublish',
      [CALL_API]: {
        endpoint: 'publish',
        method: 'DELETE',
        segments: {
          username,
          name
        }
      }
    }

    try {
      let response: Action
      response = await dispatch(action)
      await whenOk(fetchWorkingDataset(username, name))(response)
    } catch (action) {
      throw action
    }
    // return response
    return dispatch(openToast('success', 'unpublish', 'dataset unpublished'))
  }
}

export function linkDataset (username: string, name: string, dir: string): ApiActionThunk {
  return async (dispatch) => {
    const action = {
      type: 'checkout',
      [CALL_API]: {
        endpoint: 'checkout',
        method: 'POST',
        segments: {
          username,
          name
        },
        query: {
          dir
        }
      }
    }
    return dispatch(action)
  }
}

export function linkDatasetAndFetch (username: string, name: string, dir: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const whenOk = chainSuccess(dispatch, getState)
    let response: Action

    try {
      response = await linkDataset(username, name, dir)(dispatch, getState).then((response) => {
        dispatch(resetMutationsDataset())
        dispatch(resetMutationsStatus())
        return response
      })
      // reset pagination
      response = await whenOk(fetchMyDatasets(-1))(response)
      response = await whenOk(fetchWorkingDatasetDetails(username, name))(response)
    } catch (action) {
      throw action
    }
    return response
  }
}

export function discardChanges (username: string, name: string, component: SelectedComponent): ApiActionThunk {
  return async (dispatch) => {
    const action = {
      type: 'restore',
      [CALL_API]: {
        endpoint: 'restore',
        method: 'POST',
        segments: {
          username,
          name
        },
        query: {
          component
        }
      }
    }
    return dispatch(action)
  }
}

export function discardChangesAndFetch (username: string, name: string, component: SelectedComponent): ApiActionThunk {
  return async (dispatch, getState) => {
    let response: Action
    response = await discardChanges(username, name, component)(dispatch, getState)
      .then((res) => {
        dispatch(fetchWorkingDataset(username, name))
        dispatch(fetchWorkingStatus(username, name))
        return res
      })
    return response
  }
}

export function removeDataset (
  username: string,
  name: string,
  isLinked: boolean = false,
  keepFiles: boolean = true
): ApiActionThunk {
  var query: {}
  if (isLinked) {
    if (keepFiles) {
      query = { 'keep-files': true }
    } else {
      query = { 'force': true }
    }
  }

  return async (dispatch) => {
    const action = {
      type: 'remove',
      [CALL_API]: {
        endpoint: 'remove',
        method: 'DELETE',
        segments: {
          username,
          name
        },
        query
      }
    }

    let response: Action
    try {
      response = await dispatch(action)
      dispatch(openToast('success', 'remove', `Removed ${username}/${name}`))
    } catch (action) {
      dispatch(openToast('error', 'remove', action.payload.err.message))
      throw action
    }

    return response
  }
}

// remove the specified dataset, then refresh the dataset list
export function removeDatasetAndFetch (username: string, name: string, isLinked: boolean, keepFiles: boolean): ApiActionThunk {
  return async (dispatch, getState) => {
    let response: Action

    try {
      response = await removeDataset(username, name, isLinked, keepFiles)(dispatch, getState)
    } catch (action) {
      if (!action.payload.err.message.contains('directory not empty')) {
        throw action
      }
    }
    // reset pagination
    dispatch(clearSelection())
    response = await fetchMyDatasets(-1)(dispatch, getState)
    return response
  }
}

export function fsiWrite (peername: string, name: string, dataset: any): ApiActionThunk {
  return async (dispatch) => {
    const action = {
      type: 'fsiWrite',
      [CALL_API]: {
        endpoint: 'fsi/write',
        method: 'POST',
        segments: {
          peername,
          name
        },
        map: mapStatus,
        body: datasetConvertStringToScriptBytes(dataset)
      }
    }
    return dispatch(action)
  }
}

export function fetchReadmePreview (peername: string, name: string): ApiActionThunk {
  return async (dispatch) => {
    const action = {
      type: 'render',
      [CALL_API]: {
        endpoint: 'render',
        method: 'GET',
        segments: {
          peername,
          name
        }
      }
    }
    return dispatch(action)
  }
}

// peername and name are the dataset to be renamed
// newName is the new dataset's name, which will be in the user's namespace
export function renameDataset (peername: string, name: string, newName: string): ApiActionThunk {
  return async (dispatch, getState) => {
    const { peername: newPeername } = getState().session
    const whenOk = chainSuccess(dispatch, getState)
    const action = {
      type: 'rename',
      [CALL_API]: {
        endpoint: 'rename',
        method: 'POST',
        body: {
          current: `${peername}/${name}`,
          new: `${newPeername}/${newName}`
        }
      }
    }
    let response: Action
    try {
      response = await dispatch(action)
      response = await whenOk(fetchMyDatasets(-1))(response)
      dispatch(openToast('success', 'rename', `Dataset renamed`))
    } catch (action) {
      dispatch(openToast('error', 'rename', action.payload.err.message))
      throw action
    }
    return response
  }
}

export function importFile (filePath: string, fileName: string, fileSize: number): ApiActionThunk {
  return async (dispatch, getState) => {
    const whenOk = chainSuccess(dispatch, getState)
    const action = {
      type: 'import',
      [CALL_API]: {
        endpoint: 'save',
        method: 'POST',
        query: {
          bodypath: filePath,
          new: true
        },
        body: {}
      }
    }
    let response: Action
    let redirectPath = '/workbench'
    try {
      dispatch(setImportFileDetails(fileName, fileSize))
      response = await dispatch(action)
      const { peername, name } = response.payload.data
      response = await whenOk(fetchMyDatasets(-1))(response)
      redirectPath = `/workbench/${peername}/${name}`
      dispatch(setWorkingDataset(peername, name))
    } catch (action) {
      dispatch(setImportFileDetails('', 0))
      dispatch(openToast('error', 'import', action.payload.err.message))
      throw action
    }
    dispatch(setActiveTab('history'))
    dispatch(setSelectedListItem('component', DEFAULT_SELECTED_COMPONENT))
    dispatch(push(redirectPath))
    dispatch(setImportFileDetails('', 0))
    return response
  }
}
