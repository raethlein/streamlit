/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ComponentType, useState, useEffect, ReactElement } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"

import { CLOUD_COMM_WHITELIST } from "src/urls"
import { isValidURL } from "src/lib/UriUtil"

import {
  IGuestToHostMessage,
  IHostToGuestMessage,
  IMenuItem,
  IToolbarItem,
  StreamlitShareMetadata,
  VersionedMessage,
} from "./types"
import { WidgetStates } from "src/autogen/proto"

interface State {
  forcedModalClose: boolean
  isOwner: boolean
  menuItems: IMenuItem[]
  queryParams: string
  sidebarChevronDownshift: number
  streamlitShareMetadata: StreamlitShareMetadata
  toolbarItems: IToolbarItem[]
  widgetStates: WidgetStates
}

export interface S4ACommunicationHOC {
  currentState: State
  connect: () => void
  sendMessage: (message: IGuestToHostMessage) => void
  onModalReset: () => void
}

export const S4A_COMM_VERSION = 1

export function sendS4AMessage(message: IGuestToHostMessage): void {
  window.parent.postMessage(
    {
      stCommVersion: S4A_COMM_VERSION,
      ...message,
    } as VersionedMessage<IGuestToHostMessage>,
    "*"
  )
}

function withS4ACommunication(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  function ComponentWithS4ACommunication(props: any): ReactElement {
    // TODO(vdonato): Refactor this to use useReducer to make this less
    // unwieldy.
    const [menuItems, setMenuItems] = useState<IMenuItem[]>([])
    const [queryParams, setQueryParams] = useState("")
    const [forcedModalClose, setForcedModalClose] = useState(false)
    const [streamlitShareMetadata, setStreamlitShareMetadata] = useState({})
    const [isOwner, setIsOwner] = useState(false)
    const [toolbarItems, setToolbarItems] = useState<IToolbarItem[]>([])
    const [sidebarChevronDownshift, setSidebarChevronDownshift] = useState(0)
    const [widgetStates, setWidgetStates] = useState<WidgetStates>()

    useEffect(() => {
      function receiveMessage(event: MessageEvent): void {
        let origin: string
        const message: VersionedMessage<IHostToGuestMessage> | any = event.data
        console.log("received message", event, message)
        try {
          const url = new URL(event.origin)

          origin = url.hostname
        } catch (e) {
          origin = event.origin
        }

        if (
          !origin ||
          message.stCommVersion !== S4A_COMM_VERSION ||
          !CLOUD_COMM_WHITELIST.find(el => isValidURL(el, origin))
        ) {
          return
        }

        if (message.type === "CLOSE_MODAL") {
          setForcedModalClose(true)
        }

        if (message.type === "SET_IS_OWNER") {
          setIsOwner(message.isOwner)
        }

        if (message.type === "SET_MENU_ITEMS") {
          setMenuItems(message.items)
        }

        if (message.type === "SET_METADATA") {
          setStreamlitShareMetadata(message.metadata)
        }

        if (message.type === "SET_SIDEBAR_CHEVRON_DOWNSHIFT") {
          setSidebarChevronDownshift(message.sidebarChevronDownshift)
        }

        if (message.type === "SET_TOOLBAR_ITEMS") {
          setToolbarItems(message.items)
        }

        if (message.type === "UPDATE_FROM_QUERY_PARAMS") {
          setQueryParams(message.queryParams)
        }

        if (message.type === "UPDATE_HASH") {
          window.location.hash = message.hash
        }

        if (message.type === "WIDGET_STATE") {
          // sendS4AMessage({ type: "WIDGET_STATE", state: "" })
          console.log("Received message WIDGET_STATE", message.state)
          setWidgetStates(message.state)
        }
      }

      window.addEventListener("message", receiveMessage)

      return () => {
        window.removeEventListener("message", receiveMessage)
      }
    }, [])

    return (
      <WrappedComponent
        s4aCommunication={
          {
            currentState: {
              forcedModalClose,
              isOwner,
              menuItems,
              queryParams,
              sidebarChevronDownshift,
              streamlitShareMetadata,
              toolbarItems,
              widgetStates,
            },
            connect: () => {
              sendS4AMessage({
                type: "GUEST_READY",
              })
            },
            onModalReset: () => {
              setForcedModalClose(false)
            },
            sendMessage: sendS4AMessage,
          } as S4ACommunicationHOC
        }
        {...props}
      />
    )
  }

  ComponentWithS4ACommunication.displayName = `withS4ACommunication(${WrappedComponent.displayName ||
    WrappedComponent.name})`

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithS4ACommunication, WrappedComponent)
}

export default withS4ACommunication
