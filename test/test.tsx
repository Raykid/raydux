import React, { FC } from "react";
import { takeTest } from "./test-service";

export const Test: FC = () => {
  const { count, increment } = takeTest();
  return <div></div>;
};
