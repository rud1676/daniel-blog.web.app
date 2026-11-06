---
title: '[React-Query] 여행 스케줄러 앱에 React-Query를 도입하자'
description: '서버 데이터와 클라이언트 상태가 뒤섞여 복잡해진 여행 스케줄러 앱을 리팩터링하며 React-Query를 도입한 경험.'
pubDate: '2024-05-01'
category: side
layers: [front]
tags: ['React', 'react-query']
---

이전에 리팩토링 할 때 React-Query를 사용했던 경험을 적어보고자 한다. 포스팅을 할 때 React-Query의 깊은 이해에 도움을 준 [문서](https://github.com/ssi02014/react-query-tutorial?tab=readme-ov-file#%EC%A3%BC%EC%9A%94-%EC%BB%A8%EC%85%89-%EB%B0%8F-%EA%B0%80%EC%9D%B4%EB%93%9C-%EB%AA%A9%EC%B0%A8)가 있어 공유한다.

## 🎒 도입 배경

도입 전, 상태관리 관점에서 서버와 클라이언트 양쪽에 데이터가 분산되어 있어 시스템의 복잡성이 증가했다. 이로 인해 서버와 클라이언트 간의 상호작용이 복잡해지고, 명확하지 않은 데이터 상태가 생성되었다. 이런 상황은 관련 함수들을 처리할 때 중복 코드가 많이 발생하게 만들었고, 코드의 소폭 변경만으로도 예측할 수 없는 다양한 사이드 이펙트를 일으켰다.

불안 정한 코드 속에서 리팩토링 작업을 한번 해보기로 결정했고, 그에 따라 가장 먼저 신경 써주고 싶은 부분인 서버데이터 처리에 대한 부분을 변경하길 원했다. 그 관점에서 서버 상태 관리를 위한 라이브러리인 React-Query의 도입을 결심했다. 


### React Query를 선택한 이유

여러 데이터 상태 관리 라이브러리가 존재하지만, React Query에 눈이 갔던 특별한 이유는 **서버 상태관리 관점**에서는 많은 사람들이 사용하고 있었기 때문이다. 따라서 도입을 하기 위해 장점들을 조사했고 그 장점은 다음과 같다.

- **캐싱**: 변경되지 않은 데이터에 대해선, 한 번 불러온 데이터를 캐시하여 재요청 시 **서버 대신 캐시된 데이터를 사용**한다.
- **백그라운드 업데이트**: 사용자 상호작용에 따른 데이터 변경 요청(예: 여행 일정 삭제) 후, **커스텀 함수로 데이터를 갱신을 요청**할 수 있음.
- **중복 요청 제거**: 동일한 데이터에 대한 중복 요청이 있을 경우, 첫 번째 요청만 서버로 전송하고, 이후 요청은 첫 요청의 응답을 받는다. 
- React Hooks와의 **일관성**: React Query는 React Hooks 패턴을 따르고 있어, React를 사용하는 개발자들이 **쉽고 빠르게 익히고 통합할 수 있다**.
- 추가적으로, 리팩토링 시에 적용하지 않았지만 React Query는 자동화된 페이지네이션과 무한 스크롤링 지원과 같은 고급 기능을 제공해, 복잡한 데이터 집합을 효율적으로 처리할 수 있게 도와준다. 



## 🔨 사용하기

React-Query에서 TanStack Query로 브랜드명이 변경 되었는데, 그 이유는 React뿐만 아니라 다른 JavaScript 프레임워크와 라이브러리(예: Vue, Svelte 등)에서도 사용할 수 있도록 확장되었기 때문이다. 그래서 범용성을 강조하기 위해 이름을 바꿧다고 한다. ([공식문서](https://tanstack.com/query/latest)) 따라서 


```
yarn install @tanstack/react-query
```

로 설치한다 

### 1. Setting

셋팅을 하기 전에 위에서 언급한 [문서](https://github.com/ssi02014/react-query-tutorial/blob/main/document/insideReactQuery.md)에 아키텍처가 도식화 되어 있다. 모든 설명을 요약하면 아래와 같다.

- 앱에서 **1개의 QueryClient가 무조건 존재**해야 한다. - QueryClientProvider로 앱 전체에 1개의 QueryClient가 전달 될 수 있도록 한다.
- QueryClient를 통해 **cache와 상호작용** 하고 그 Cache에 있는 Query들이 로직이 실행이 된다. 누가 Query에 관심이 있는지, Observers들에게 모두 변경사항을 알릴 수 있다. 또한 Cache는 브라우저 메모리에 있는 객체이다.
- **Observer는** Query와 사용하는 컴포넌트를 연결해주는 역활. **useQuery를 호출할 때 생성**이 되고, 하나의 Query를 구독해야한다.(queryKey를 전달)

```jsx
// AppContainer.jsx
const AppContainer = ({ children }) => {
//...
  const queryClientRef = useRef();
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          throwOnError: true,
        },
      },
    });
  }
  return (
        <QueryClientProvider client={queryClientRef.current}>
            {children}
        </QueryClientProvider>
  );
};

export default AppContainer;
```

- react-query를 사용하기 위한 준비는 **QueryClientProvider를 최상단에서 감싸주고** QueryClient 인스턴스를 client props로 넣어 애플리케이션에 연결해야 한다.

- 위 예시에서 AppConatiner.jsx에 QueryClientProvider로 컴포넌트를 감싸고(App.jsx를 감싸는 역활을 하는 컴포넌트다), client props에다 queryClient를 연결함으로써, 이 context는 앱에서 비동기 요청을 알아서 처리하는 background 계층이 된다.

참고로 defaultOptions에는 query와 Mutate에서 사용할 때 기본 옵션을 줄 수 있다. 옵션에 대한 정보는 [공식문서](https://tanstack.com/query/latest/docs/framework/react/overview) 에서 살펴보고 정하면 된다. 

기본 옵션으로는 
- throwOnError: true
를 정해줬는데, 쿼리 실행 중 발생한 오류가 있을 때 예외를 발생시키도록 지정하는 옵션이다. 기본값이 false로 되어 있어 true로 바꿔주었다. 엄격한 쿼리 관리를 위해서 추가해 주었다.



### 2. 메인화면(패키지여행 리스트 받아오기)


React Query 도입 전에는 페이지의 최상위 컴포넌트에서 여행 상품이라는 상태를 보여지는 메인화면 뿐만 아니라 **거의 모든 하위 컴포넌트로 상태를 props로 전달**했다.

페이지에 있는 정렬 버튼, 검색 기능이 상품의 상태 변화를 유도하기 위함이었는데, state나 setState를 거의 모든 하위 컴포넌트에 props로 넘기는 prop-drilling 문제가 발생했다. 

이 구조는 코드의 중복이 너무나 많이 발생했고, 코드가 조금 변경되도 사이드 이팩트를 유도했다.

따라서 코드를 단순화하기 위해, **서버에서 가져오는 데이터를 React Query로 변경**하였습니다. 

그 과정에서 useSuspenseQuery를 사용했는데, 이 훅은 useQuery의 Suspense 옵션을 활성화한 형태로, 데이터 로딩 시 fallbackUI를 활용하여 사용자에게 로딩 상태를 보다 명확하게 표시한다. 

프로젝트는 App Routing을 사용하고 있으며, 로딩 상태를 처리하는 Loading.jsx 컴포넌트가 이미 구현되어 있었기에 해당 훅을 사용했다.

참고로 4v에서는 useQuery에 Suspense옵션을 true, false로 지정할 수 있지만, 5v에서는 useSuspensQuery로 따로 추가가 되었다. 이는 안정화 과정에서 따로 빠진 듯 하다.

useSuspensQuery의 동작을 순서대로 간략하게 나열하면 아래와 같다.

1. Suspense mount
2. MainComponent mount
3. MainComponent에서 useSuspenseQuery 훅을 사용하여 비동기 데이터 요청
4. MainComponent unmount, fallback UI인 Loading.jsx mount
5. 비동기 데이터 요청이 완료되면 fallback UI인 Loading.jsx unmount
6. MainComponent mount

따라서 작성된 코드는 아래와 같다.

```jsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { travelPackageApi } from "@/api/travel";

import Package from "./Package";

const Packages = () => {
  const { data } = useSuspenseQuery({
    queryKey: ["packages"],
    queryFn: () => travelPackageApi.list("", "createdAt"),
    enabled: true,
  });

  return (
    <>
      {data?.length >= 1 ? (
        data.map((v) => <Package id={v.id} key={v.id} Package={v} />)
      ) : (
        <div>데이터가 없습니다.</div>
      )}
    </>
  );
};

export default Packages;
```

useQuery에 사용되는 옵션을 [공식문서](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
) 보면 엄청많은데 주요한 옵션을 몇 가지 살펴보자.

- queryKey : 캐싱을 위한 고유 값으로 지정. 배열로 지정해 줘야 한다,
- queryFn : Promise를 반환하는 함수를 넣어야 한다. 성공되어 반환된 값은 data 변수 안에 있다.
- enabled : 쿼리가 자동으로 실행될지 여부.

**사용하지 않았지만 캐시를 다루는 옵션**
- staleTime: 캐시를 다루는 데 관련된 값이다. (number | Infinity 기본값 = 0분) staleTime은 데이터가 fresh에서 stale 상태로 변경되는 데 걸리는 시간. fresh상태에서는 쿼리 인스턴스가 새롭게 mount되도 요청이 일어나지 않는다. 그러나 stale일 땐 요청이 일어난다.
- gcTime: 데이터가 사용하지 않거나, inactive 상태일 때 캐싱 된 상태로 남아있는 시간이다. 쿼리 인스턴스가 unmount 되면 데이터는 inactive 상태로 변경되며, 캐시는 gcTime만큼 유지된다.  기본값은 5분이고, SSR환경에서는 Infinity이다.



### 3. 정렬버튼과 검색버튼 데이터요청

정렬 버튼을 누른다면 메인 화면의 패키지 여행들의 순서를 서버에서 받아 다시 보여줘야된다. 따라서 위에서 만든 **package와 동일한 데이터를 search나 sort키워드를 넘겨서 다시 받는다**. 따라서 queryClient를 통해 캐시를 받아와서 fetchQuery 함수를 통해 데이터를 받는다.

```jsx
  const queryClient = useQueryClient();

  const FetchSortingPackages = async (search) => {
    queryClient.fetchQuery({
      queryKey: ["packages"],
      queryFn: () => {
        return travelPackageApi.list(search);
      },
    });
  };
```

cache된 쿼리를 다시 fetch한다. Key를 지정하고 Promise 반환하여 동작을 정의한다.


### 4. Mutate

데이터의 수정을 요청하는 동작은 **실패와 성공에 대한 처리가 매우 비슷**했다. 실패시에는 실패에 대한 메세지를 서버에서 받아서 처리하고, 성공시에는 "작업이 완료되었습니다"라고 메세지를 넣어주고, 추가로 router처리를 해 페이지 이동을 해줄지 말지 결정을 했다.

그래서 매번 에러와 성공의 처리를 똑같은 코드 작성이 중복 코드를 발생 시키므로 useCustomMutate라는 customHook을 작성하였다.

useMuate에 대한 프로퍼티에 대한 설명은 아래와 같다.
- `onMutate`:  mutate가 실행되기 직전에 호출한다. 데이터 변경을 요청하기에 "처리중입니다..."라는 공통 UI를 토스트메세지로 보여준다.
- `onSuccess`: 요청이 완료되었을 때 SuccessMessage를 받아 보여준다. 만약 Route함수가 문자열을 반환한다면 있다면 해당 함수를 실행해 문자열에 적힌 라우터로 보내준다. 
- `onError`: 에러가 발생시 토스트메세지로 서버에서 받은 에러메세지를 보여준다.

```jsx
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

const useCustomMutate = (mutationFn, SuccessMessage, SuccessRoute) => {
  const navigator = useRouter();
  const { mutate } = useMutation({
    mutationFn,
    onMutate: () => {
      // 뮤테이션 시작 시 로딩 토스트 표시
      toast.loading("처리 중입니다...");
    },
    onSuccess: (data, _variables, _context) => {
      toast.dismiss();
      toast.success(SuccessMessage);
      if (SuccessRoute(data)) navigator.replace(SuccessRoute(data));
    },
    onError: (error, _variables, _context) => {
      toast.dismiss();
      toast.error(
        `서버에 오류가 있습니다 관리자에게 문의하세요. \n 에러내용 : ${error.message}`
      );
    },
  });

  return mutate;
};

export default useCustomMutate;
```


해당 커스텀 훅을 "검색어 삭제 버튼"에 적용했다.

```jsx
// RecentKeywords.jsx
//....
  const mutate = useCustomMutate(
    ({ id }) => travelSearchApi.deleteRecentSearch(id),
    "최근 검색어를 삭제 하였습니다.",
    () => {
      queryClient.refetchQueries({ queryKey: ["recent"], type: "active" });
      return;
    }
  );
//...
```

## 🤔 후기


실제로 적용해보고 가장 마음에 들었던 부분은 캐싱 처리였다. 도입 전에는 사용자가 여행 상품을 검색할 때마다 상품 컴포넌트를 검색 컴포넌트로 교체하면서, 같은 데이터에 대해 검색을 켜고 끌 때마다 API 호출을 매번 처리되었다. 그러나 React Query 도입 이후, 캐싱된 데이터를 자동으로 관리하며 필요할 때 재활용해 네트워크 비용을 크게 줄일 수 있었다.

React Query의 기능을 포스팅 하며 더 깊이 탐구하면서 다양한 옵션과 함수들을 효과적으로 활용하면, 더 복잡한 애플리케이션에서도 서버 데이터를 매우 효율적으로 처리할 수 있겠다는 생각을 했다. 따라서 다른 프로젝트를 진행할 기회가 있다면, React Query의 도입을 적극적으로 권장 하고싶다.
