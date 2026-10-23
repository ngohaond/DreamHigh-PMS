# Phase D Execution Plan - Tài chính, Báo cáo và Placement Test

> **Mục tiêu:** Chốt và thực thi Phase D theo roadmap MVP: FR12, FR16-FR20.
> **Phạm vi:** Placement Test; học phí, ưu đãi, invoice/payment, phiếu thu PDF, báo cáo công nợ và frontend kết nối API thật.
> **Không thuộc phạm vi:** Payment gateway, QBO/SePay, SMS/Zalo, payroll/thù lao giáo viên, Phase E CI/E2E tổng thể.
> **Nguồn chuẩn:** `docs/qa/Development_Roadmap_MVP.md`, `_bmad-output/planning-artifacts/epics.md`, Stories 2.3 và 5.1-5.5, `docs/qa/Test_Case_Suite_MVP.md`.

## Baseline trước khi triển khai

- Stories 2.3 và 5.1-5.5 đang `ready-for-dev` trong `sprint-status.yaml`.
- Backend hiện chưa có module finance; schema đã có `InvoicePaymentStatus`, `PaymentMethod`, `Invoice`, `Payment` nhưng cần đọc toàn bộ model/migration trước khi quyết định sửa hay tái sử dụng.
- Placement đang tính barem hardcode trong `EnrollmentService`; controller nhận `any`; chưa lưu PlacementTest.
- Frontend Finance hiện có `AdjustmentModal` dành cho thù lao giáo viên, không phải nghiệp vụ học phí. CRM còn dữ liệu thanh toán mock; Dashboard chưa có finance route/API.
- Phase D finance phụ thuộc Student/Class đã ổn định ở các phase trước. Placement có thể chạy song song nếu Level/master data dùng được.

## Kết quả triển khai

- D0-D6 đã thực hiện theo dependency graph; D1-D5 có compact handoff riêng trong `.github/modernize/rearchitecture/artifacts/`.
- D1-D5 hoàn tất implementation; D6 xác nhận PASS cho code review/UAT qua clean-schema migrations, backend tests, authenticated API scenarios và browser workflow.
- Stories 2.3 và 5.1-5.5 chuyển `review`, chưa `done`; cần BA/PO review và cấu hình barem Level vận hành.
- Kết quả cuối cùng và acceptance evidence: [`PHASE_D_QA_REPORT_FINAL.md`](PHASE_D_QA_REPORT_FINAL.md). Báo cáo D6 ban đầu được giữ lại để audit và đã superseded.
- Local development database đã nhận các migration Phase D additive; dữ liệu nghiệp vụ không bị reset/xóa. Kiểm thử authenticated dùng schema PostgreSQL cô lập và synthetic fixtures.
- Hạn chế còn lại: full frontend lint có 31 lỗi + 1 warning ngoài D1/D5; per-skill maximum score chưa có quyết định BA.

## Quy ước phân công

Mỗi work package có đúng một agent chịu trách nhiệm chính (DRI) và sở hữu các file trong phạm vi của mình. Không cho hai agent cùng sửa `schema.prisma`, migration hoặc cùng một màn hình. Agent phụ thuộc chỉ bắt đầu tích hợp sau khi owner công bố contract/API và handoff.

Tên Agent D1-D6 dưới đây là vai trò giao việc trong execution brief; người điều phối gán chúng cho các coding agent/agent chuyên môn đang khả dụng. Agent không tự mở rộng scope hay đánh dấu story Done khi chưa qua gate.

## WBS và phân công

### D0 - Chốt quyết định nghiệp vụ

- **Agent:** D0 - BA/Business Analyst
- **Ưu tiên:** Blocker cho D2-D5; làm trước khi khóa API contract.
- **Phạm vi:** Ghi quyết định cho: ngày đến hạn và định nghĩa quá hạn; thứ tự kết hợp discount % và fixed; xử lý payment vượt outstanding; quy tắc điều chỉnh/hủy invoice/payment; cấp quyền theo role và branch; các trường bắt buộc trên receipt.
- **Đầu ra:** Bảng quyết định ngắn trong `docs-BA/Business_Decision_Register_MVP_v0.2.md` hoặc bản kế tiếp, có người duyệt và trạng thái. Không tự suy diễn chính sách chưa được duyệt.
- **Nghiệm thu:** Các điểm còn mở ảnh hưởng đến dữ liệu/API/UI được quyết định hoặc đánh dấu rõ là blocker; DRI backend không tự chọn cách tính.
- **Compact checkpoint:** Tóm tắt quyết định, giả định còn mở và API/data impact để chuyển cho D1-D5.

### D1 - Placement Test (FR12)

- **Agent:** D1 - Enrollment/Placement
- **Có thể chạy:** Song song với D0/D2 sau khi xác nhận model Level hiện tại.
- **Phạm vi sở hữu:** Prisma PlacementTest + migration; DTO/controller/service trong `pms-eng-api/src/modules/enrollment`; phần UI placement trong hồ sơ học viên; unit test/API test và cập nhật Story 2.3.
- **Yêu cầu:** Lưu điểm kỹ năng, tổng điểm, ngày thi, studentId, recommendedLevelId; map barem từ master data Level/config, không hardcode; kiểm tra biên min/max; bỏ `any` ở endpoint; giới hạn quyền và branch scope; hiển thị kết quả gợi ý từ API thật.
- **Test tối thiểu:** 2.3-TC-06/07, điểm tại biên barem, không tìm thấy barem, student không tồn tại/ngoài branch.
- **Handoff:** Migration, contract request/response, cách cấu hình barem, test command, file list và rủi ro còn lại.
- **Compact checkpoint:** Ghi kết quả, commit/hash nếu có theo quy trình nhóm (không tự commit nếu chưa được yêu cầu), test đã chạy, migration/API contract, việc còn dở và dependency kế tiếp.

### D2 - Finance Core (FR16-FR18)

- **Agent:** D2 - Backend Finance Core
- **Phụ thuộc:** D0 đã chốt quyết định nghiệp vụ; Student/Class/branch ownership đã ổn định.
- **Phạm vi sở hữu:** Models/migrations finance; module `pms-eng-api/src/modules/finance`; FeePlan CRUD/deactivate; Discount; invoice creation; payment recording; DTO, validation, RBAC/branch policy, audit và unit/integration tests của module.
- **Yêu cầu:** Tái sử dụng/điều chỉnh `Invoice`/`Payment` schema hiện có sau khi kiểm tra toàn model và migrations; tiền VND không âm; snapshot đơn giá/discount trên invoice; payment + cập nhật trạng thái/outstanding trong transaction; idempotency theo transactionRef; không nhận branchId thiếu kiểm soát từ client; lỗi nghiệp vụ không làm lộ Prisma internals.
- **Test tối thiểu:** 5.1-TC-01..03, 5.2-TC-01..04 theo quyết định D0, 5.3-TC-01..06; branch isolation cho create/read/update.
- **Handoff:** OpenAPI/route + DTO + envelope, schema/migration, trạng thái idempotency và transaction, seed/test data, test command.
- **Compact checkpoint:** Tóm tắt contract đã khóa, migrations, test evidence, các điểm chưa hoàn thiện; không yêu cầu agent kế tiếp đọc lại toàn bộ hội thoại.

### D3 - Phiếu thu PDF (FR19)

- **Agent:** D3 - Receipt/PDF
- **Phụ thuộc:** D2 công bố Payment read contract và quyền truy cập ổn định.
- **Phạm vi sở hữu:** Service/template tạo PDF, endpoint receipt, test PDF; component/nút tải phiếu thu riêng. Không sửa Finance Core hoặc trang Dashboard.
- **Yêu cầu:** PDF chứa số phiếu, ngày, học viên, số tiền, phương thức, người thu và reference; hỗ trợ Unicode tiếng Việt; kiểm tra quyền/branch trước khi đọc payment; không làm lộ thông tin khi payment không thuộc phạm vi; có loading/error state ở nút tải.
- **Test tối thiểu:** 5.4-TC-01/03; kiểm tra font/dấu tiếng Việt bằng render hoặc kiểm tra thủ công có bằng chứng.
- **Handoff:** API/file response, package PDF nếu thêm, test evidence và hướng dẫn xác nhận rendering.
- **Compact checkpoint:** Ghi endpoint, package, cách test Unicode, test results và hạn chế.

### D4 - Arrears API (FR20 backend)

- **Agent:** D4 - Backend Reporting
- **Phụ thuộc:** D0 định nghĩa dueDate/quá hạn; D2 cung cấp invoice/outstanding contract.
- **Phạm vi sở hữu:** `GET /reports/arrears` (hoặc route được thống nhất), query/filter, aggregate, pagination, unit/integration tests. Không sửa finance schema/core trừ khi D2 duyệt thay đổi qua handoff.
- **Yêu cầu:** Tổng nợ, số học viên còn nợ, tổng quá hạn; lọc branch/date/status và tìm học viên; chỉ trả khoản còn outstanding; đúng hạn/quá hạn theo quyết định BA; enforce branch access ở backend.
- **Test tối thiểu:** 5.5-TC-01..03; nhánh A không đọc được dữ liệu nhánh B; khoản đã thanh toán không xuất hiện trong nợ.
- **Handoff:** Contract query/response, pagination, semantics aggregate, test evidence.
- **Compact checkpoint:** Ghi cách tính, quyền/filter, test results và dependency FE.

### D5 - Finance UI và dashboard (FR16-FR20 frontend)

- **Agent:** D5 - Frontend Finance
- **Phụ thuộc:** D2 route/contract ổn định; D4 arrears contract; D3 receipt control contract.
- **Phạm vi sở hữu:** Route `/finance`, màn hình fee plan/discount/invoice/payment, finance dashboard/arrears, API query/mutation, liên kết hồ sơ học viên; loading/empty/error/permission states. Tích hợp receipt component của D3 nhưng không sở hữu implementation PDF.
- **Yêu cầu:** Không dùng dữ liệu mock trong luồng hoàn tất; dữ liệu tồn tại sau reload; không dùng mock `branchId`/financial data; giữ nguyên payroll UI vì không thuộc Phase D; export Excel chỉ triển khai nếu xác nhận nằm trong scope FR20/NFR3 và có API/data contract.
- **Test tối thiểu:** UI smoke cho cấu hình phí -> tạo invoice -> discount -> payment -> xem công nợ -> tải receipt; role không đủ quyền không hiển thị thao tác nhạy cảm và backend vẫn enforce.
- **Handoff:** Các luồng UI đã kết nối, test/build commands, endpoints sử dụng, vấn đề API còn lại.
- **Compact checkpoint:** Tóm tắt route/component, trạng thái API wiring, test evidence và vấn đề còn lại.

### D6 - QA tích hợp và đóng Phase D

- **Agent:** D6 - QA/Integration
- **Phụ thuộc:** D1-D5 hoàn thành và đã handoff.
- **Phạm vi sở hữu:** Bộ test tích hợp luồng Phase D, regression checks, đối chiếu Test_Case_Suite, cập nhật trạng thái stories/sprint-status sau khi có bằng chứng. Không viết lại tính năng để che lỗi; bug được trả về đúng DRI.
- **Luồng nghiệm thu:** Tạo/cập nhật học viên hợp lệ -> cấu hình fee plan -> tạo invoice -> áp discount -> ghi payment -> xác nhận status/outstanding -> tải receipt -> xem arrears dashboard; thêm một placement test riêng với gợi ý level.
- **Gate bắt buộc:** Migration chạy trên DB sạch; Prisma validate; backend tests; frontend lint/build/tests hiện có; branch isolation cho finance/receipt/report; không còn mock trong luồng; PDF tiếng Việt đọc được; idempotency/rollback chứng minh được.
- **Handoff:** Báo cáo PASS/FAIL theo từng TC, bug owner, rủi ro chấp nhận, quyết định go/no-go Phase D.
- **Compact checkpoint:** Báo cáo tổng kết ngắn theo `Task / Result / Tests / Open risks / Next owner`; đóng Phase D chỉ khi tất cả P0 pass.

## Trình tự và luồng song song

```text
D0 BA decisions ───────────────┬─> D2 Finance Core ──┬─> D3 Receipt PDF ─┐
                               │                     └─> D4 Arrears API ─┼─> D5 Finance UI ─> D6 QA
D1 Placement (parallel) ───────┘                                         ┘
```

D1 có thể bắt đầu song song nhưng cần xác nhận cấu hình Level/master data trước khi sửa schema. D3 và D4 có thể chạy song song sau khi D2 khóa contract. D5 có thể chuẩn bị layout/API adapter trước, nhưng chỉ kết nối hoàn chỉnh sau khi D2-D4/D3 bàn giao contract.

## Quy tắc handoff/compact

Sau **mỗi work package**, DRI dừng, cập nhật story/checklist liên quan và gửi compact handoff gồm:

```text
Task/Agent:
Scope completed:
Files or contracts changed:
Tests run + result:
Decision/assumption:
Open risks/blockers:
Next agent + exact dependency:
```

Trong phiên làm việc hiện tại không có tool theo dõi ngưỡng 120k token hoặc lệnh `compact/compack` để chủ động nén context. Vì vậy không thể cam kết tự chạy nén tại đúng ngưỡng; dùng handoff trên sau từng phần việc để giữ context nhỏ, và dùng tính năng `/compact` của môi trường điều phối nếu phiên đó hỗ trợ.

## Definition of Done - Phase D

- FR12 và FR16-FR20 có API + UI + dữ liệu bền vững sau reload.
- Test cases 2.3-TC-06/07 và 5.1-5.5 P0 pass; test còn lại có trạng thái/evidence rõ ràng.
- Migration/Prisma validate pass trên database sạch; transaction, idempotency, branch isolation được kiểm chứng.
- Phiếu thu có Unicode tiếng Việt và kiểm soát quyền đúng branch.
- Arrears totals/list/filter khớp dữ liệu kiểm thử và không lộ dữ liệu branch khác.
- Không còn dữ liệu mock trên các luồng Phase D; mọi quyết định nghiệp vụ cần thiết đã được ghi nhận.
- Stories chỉ chuyển `done` sau khi QA D6 xác nhận bằng chứng; Phase E/UAT vẫn là gate tiếp theo, không đánh đồng với hoàn tất Phase D.
