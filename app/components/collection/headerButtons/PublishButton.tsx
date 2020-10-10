import * as React from 'react'
import { faCloudUploadAlt, faCloud } from '@fortawesome/free-solid-svg-icons'
import { shell, clipboard } from 'electron'
import ReactTooltip from 'react-tooltip'

import { RouteProps } from '../../../models/store'
import { QRI_CLOUD_URL } from '../../../constants'
import { Modal, ModalType } from '../../../models/modals'
import { QriRef, qriRefFromRoute } from '../../../models/qriRef'

import { setModal } from '../../../actions/ui'

import { selectIsPublished, selectInNamespace, selectLatestPath } from '../../../selections'

import HeaderColumnButton from '../../chrome/HeaderColumnButton'
import { connectComponentToPropsWithRouter } from '../../../utils/connectComponentToProps'

interface PublishButtonProps extends RouteProps {
  qriRef: QriRef
  inNamespace: boolean
  isPublished: boolean
  latestPath: string
  setModal: (modal: Modal) => void
  showIcon: boolean
}

// show if at head & is not published
export const PublishButtonComponent: React.FunctionComponent<PublishButtonProps> = (props) => {
  const {
    qriRef,
    inNamespace,
    isPublished,
    latestPath,
    setModal,
    showIcon
  } = props

  // The `ReactTooltip` component relies on the `data-for` and `data-tip` attributes
  // we need to rebuild `ReactTooltip` so that it can recognize the `data-for`
  // or `data-tip` attributes that are rendered in this component
  React.useEffect(ReactTooltip.rebuild, [])

  const { username, name, path = '' } = qriRef
  const datasetSelected = username !== '' && name !== ''
  const atHead = path !== '' && path === latestPath

  if (!inNamespace || !datasetSelected || isPublished) {
    return null
  }

  if (atHead) {
    return (
      <span data-tip={'Publish this dataset to Qri Cloud'}>
        <HeaderColumnButton
          id='publish-button'
          label='Publish'
          icon={showIcon && faCloudUploadAlt}
          disabled={!atHead || latestPath === ''}
          onClick={() => {
            setModal({
              type: ModalType.PublishDataset,
              username,
              name
            })
          }}
        />
      </span>
    )
  }
  return null
}

export default connectComponentToPropsWithRouter(
  PublishButtonComponent,
  (state: any, ownProps: PublishButtonProps) => {
    const qriRef = qriRefFromRoute(ownProps)
    return {
      qriRef,
      inNamespace: selectInNamespace(state, qriRef),
      isPublished: selectIsPublished(state),
      latestPath: selectLatestPath(state, qriRef.username, qriRef.name),
      ...ownProps
    }
  },
  {
    setModal
  }
)
