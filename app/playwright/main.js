const { chromium } = require("playwright");
const readline = require("readline");
const axios = require("axios");
const crypto = require("crypto");

// ⭐ 사용자의 API 인증 정보
const CUSTOMER_ID = "3471918";
const API_KEY =
  "01000000001489e7c4445808aaf00769d59e9a2d97b4bd1752c633f7987065a87c4836402d";
const SECRET_KEY = "AQAAAAAUiefERFgIqvAHadWemi2XLLCS6+Jj1cWsIv5p7LubNQ==";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// placeId 추출: /place/1234, /restaurant/1234, /hospital/1234 모두 지원
function extractPlaceId(url) {
  const match = url.match(/(?:place|restaurant|hospital)\/(\d+)/);
  return match ? match[1] : null;
}

// API Signature 생성 함수
function createSignature(timestamp, method, uri, secretKey) {
  const space = " ";
  const newLine = "\n";
  const message = `${timestamp}${newLine}${method}${space}${uri}${newLine}`;
  return crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");
}

// 검색량 조회 함수
async function getKeywordSearchVolume(keyword) {
  const uri = "/keywordstool";
  const endpoint = `https://api.naver.com${uri}`;
  const method = "GET";
  const timestamp = Date.now().toString();
  const signature = createSignature(timestamp, method, uri, SECRET_KEY);

  const headers = {
    "X-Timestamp": timestamp,
    "X-API-KEY": API_KEY,
    "X-Customer": CUSTOMER_ID,
    "X-Signature": signature,
  };

  try {
    const response = await axios.get(endpoint, {
      headers,
      params: {
        hintKeywords: keyword,
        showDetail: 1,
      },
    });

    const keywordData = response.data.keywordList.find(
      (k) => k.relKeyword === keyword
    );
    if (keywordData) {
      return {
        pc: keywordData.monthlyPcQcCnt,
        mobile: keywordData.monthlyMobileQcCnt,
      };
    } else {
      console.log("❗ 검색량 정보를 찾지 못했습니다.");
      return null;
    }
  } catch (err) {
    console.error("❗ 검색량 API 호출 실패:", err.message);
    return null;
  }
}

// 메인 실행
(async () => {
  const keyword = await askQuestion("대표키워드를 입력하세요: ");
  const placeUrl = await askQuestion("플레이스 URL을 입력하세요: ");
  rl.close();

  const placeId = extractPlaceId(placeUrl);
  if (!placeId) {
    console.error("❗ placeId를 URL에서 찾을 수 없습니다.");
    return;
  }

  const mobileUrl = `https://m.place.naver.com/restaurant/${placeId}/home`;
  console.log(`📱 모바일 URL: ${mobileUrl}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 업체 정보 + 대표키워드2 추출
  let keywordList = [];
  let targetShopName = "";
  try {
    await page.goto(mobileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const content = await page.content();
    const keywordMatch = content.match(/"keywordList":(\[.*?\])/);
    if (keywordMatch) {
      keywordList = JSON.parse(keywordMatch[1]);
    }

    const nameElement = await page.waitForSelector(".GHAhO", {
      timeout: 10000,
    });
    targetShopName = (await nameElement.innerText()).trim();
    console.log(`🏪 업체명: ${targetShopName}`);
    console.log(`🏷️ 업체 대표 키워드 설정: ${keywordList.join(", ")}`);
  } catch (e) {
    console.error("❗ 업체 정보 추출 실패:", e);
  }

  // 검색 페이지 열기
  const searchPage = await browser.newPage();
  const searchUrl = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(
    keyword
  )}`;
  await searchPage.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // 더보기 클릭
  try {
    const moreBtn = await searchPage.$(".PNozS, .Jtn42");
    if (moreBtn) {
      await moreBtn.scrollIntoViewIfNeeded();
      await moreBtn.click();
      await searchPage.waitForTimeout(1500);
    }

    const detailBtn = await searchPage.waitForSelector(".UPDKY", {
      timeout: 5000,
    });
    await detailBtn.scrollIntoViewIfNeeded();
    await detailBtn.click();
    await searchPage.waitForTimeout(2000);
  } catch {
    console.log("⚠️ 더보기/상세 버튼 클릭 실패 또는 없음");
  }

  // 리스트 끝까지 스크롤
  let prevCount = 0;
  while (true) {
    const items = await searchPage.$$("li.VLTHu, li.DWs4Q");
    if (items.length === prevCount) break;
    prevCount = items.length;
    await searchPage.mouse.wheel(0, 1000);
    await searchPage.waitForTimeout(1000);
  }

  // 업체 순위 탐색
  const listItems = await searchPage.$$("li.VLTHu, li.DWs4Q");
  let rank = 0;
  let found = false;

  for (const item of listItems) {
    const isAd = await item.$(".dPXjn");
    if (isAd) continue; // 광고 제외

    const link = await item.$("a");
    if (link) {
      const href = await link.getAttribute("href");
      const idMatch = href?.match(/\/(place|restaurant|hospital)\/(\d+)/);
      const itemId = idMatch ? idMatch[2] : null;

      if (itemId) rank++;

      if (itemId === placeId) {
        console.log(`✅ 내 업체는 검색 결과 ${rank}위 (광고 제외)`);
        found = true;
        break;
      }
    }
  }

  if (!found) {
    console.log("❗ 검색 결과에서 업체를 찾지 못했습니다.");
  }

  // 검색량 API 호출
  const volume = await getKeywordSearchVolume(keyword);
  if (volume) {
    console.log(
      `🔍 대표키워드 검색량: PC ${volume.pc} / Mobile ${volume.mobile}`
    );
  }

  await browser.close();
})();
