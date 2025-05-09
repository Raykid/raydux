import { Action, createStore, StoreEnhancer } from "redux";

export type PayloadActiion<P> = Action<string> & {
  payload: P;
};

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: () => StoreEnhancer;
  }
}

let reduxDevtoolsEnhancer: StoreEnhancer | undefined = undefined;
try {
  reduxDevtoolsEnhancer =
    window.__REDUX_DEVTOOLS_EXTENSION__ &&
    window.__REDUX_DEVTOOLS_EXTENSION__();
} catch {}

const regInternalActionType = /^(\w+)::(.+)$/;
const oriReducer = (state: any, action: PayloadActiion<any>) => {
  if (
    action.type === "@@INIIT" ||
    action.type.startsWith("@@redux/INIT") ||
    action.type.startsWith("@@redux/REPLACE")
  ) {
    return state || {};
  } else if (action.type.indexOf("::") >= 0) {
    const [, type, name] = regInternalActionType.exec(action.type)!;
    switch (type) {
      case "initializeService": {
        const initialState = action.payload;
        if (Object.hasOwnProperty.call(state, name)) {
          throw new Error(`Duplicate service name: ${name}`);
        }
        return {
          ...state,
          [name]: initialState,
        };
      }
      case "setState": {
        return {
          ...state,
          [name]: action.payload,
        };
      }
      default: {
        return state;
      }
    }
  } else {
    return state;
  }
};

export const store = createStore(oriReducer, reduxDevtoolsEnhancer);
