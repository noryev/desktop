import * as React from 'react'
import { faCloudRain } from '@fortawesome/free-solid-svg-icons'

import { RouteProps } from '../../../models/store'
import { Modal, ModalType } from '../../../models/modals'
import { isDatasetSelected, QriRef, qriRefFromRoute } from '../../../models/qriRef'

import { setModal } from '../../../actions/ui'

import { selectIsPublished, selectInNamespace, selectLatestPath } from '../../../selections'

import HeaderColumnButton from '../../chrome/HeaderColumnButton'
import { connectComponentToPropsWithRouter } from '../../../utils/connectComponentToProps'

interface UnpublishButtonProps extends RouteProps {
  qriRef: QriRef
  inNamespace: boolean
  isPublished: boolean
  latestPath: string
  setModal: (modal: Modal) => void
  showIcon?: boolean
}

/**
 * If there is a dataset selected, we are in the user's namespace, the dataset
 * is published and we are at the latest version, show the `UnpublishButton`
 *  NOTE: before adjusting any logic in this component, check out the
 * `DatasetActionButtons` story in storybook to double check that it still works
 * as expected
 */
export const UnpublishButtonComponent: React.FunctionComponent<UnpublishButtonProps> = (props) => {
  const {
    qriRef,
    inNamespace,
    isPublished,
    latestPath,
    setModal,
    showIcon = true
  } = props

  const { username, name, path = '' } = qriRef
  const datasetSelected = isDatasetSelected(qriRef)
  const atHead = path !== '' && path === latestPath

  if (!(inNamespace && datasetSelected && isPublished && atHead)) {
    return null
  }

  return (
    <span data-tip={'Unpublish this dataset from Qri Cloud'}>
      <HeaderColumnButton
        id='unpublish-button'
        label='Unpublish'
        icon={showIcon && faCloudRain}
        onClick={() => {
          setModal({
            type: ModalType.UnpublishDataset,
            username,
            name
          })
        }}
      />
    </span>
  )
}

export default connectComponentToPropsWithRouter(
  UnpublishButtonComponent,
  (state: any, ownProps: UnpublishButtonProps) => {
    const qriRef = qriRefFromRoute(ownProps)
    return {
      ...ownProps,
      qriRef,
      inNamespace: selectInNamespace(state, qriRef),
      isPublished: selectIsPublished(state),
      latestPath: selectLatestPath(state, qriRef.username, qriRef.name)
    }
  },
  {
    setModal
  }
)
