export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export function ok<T>(data: T): ApiResponse<T> {
  return {
    code: 0,
    message: 'ok',
    data,
  };
}
