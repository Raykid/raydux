import { Take } from "../hooks";

export type Middleware<Props = void> = <State>(
  take: Take<State>,
  props: Props
) => Take<State>;
