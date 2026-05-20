import { ArrowLeft, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { Client, Contact, Product } from "./api";
import {
  canRenderSectionTable,
  EntityActions,
  EntityNameCell,
  EntityStatusField,
  EntitySummary,
  ModalActions,
  renderCrmStatus,
  useEntityFormState
} from "./EntityCrudShared";
import type { WorkspaceData } from "./workspaceData";
import { makeClientGeneratedId } from "./workspaceIds";
import { useCrmMutations } from "./workspaceQueries";
import {
  type FormErrors,
  getFieldErrorId,
  hasFormErrors,
  validateClientForm,
  validateContactForm,
  validateProductForm
} from "./workspaceForms";
import {
  filterClientsForTable,
  filterContactsForTable,
  filterProductsForTable
} from "./workspaceTables";
import { formatDate, formatMoney } from "./workspaceViewHelpers";
import {
  getErrorMessage,
  hasPermission,
  type SectionState
} from "./workspaceShellState";
import {
  CrudToolbar,
  DisabledAction,
  FieldError,
  Modal,
  Panel,
  SectionFeedback,
  TableEmpty
} from "./components/workspace-ui";

export function ProductsView(props: {
  activeProductId?: string | null;
  data: WorkspaceData;
  onBack?: () => void;
  onOpenProduct?: (productId: string) => void;
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canManageProducts = hasPermission(props.data.permissions, "tenant.products.manage");
  const crmMutations = useCrmMutations();
  const [search, setSearch] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formState = useEntityFormState();
  const editingProduct = editingProductId
    ? props.data.products.find((product) => product.id === editingProductId) ?? null
    : null;
  const isSaving =
    crmMutations.createProduct.isPending || crmMutations.updateProduct.isPending;
  const filteredProducts = useMemo(
    () => filterProductsForTable(props.data.products, search),
    [props.data.products, search]
  );
  const activeProducts = props.data.products.filter((product) => product.status === "active").length;
  const activeProduct = props.activeProductId
    ? props.data.products.find((product) => product.id === props.activeProductId) ?? null
    : null;

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const sku = String(form.get("sku") ?? "");
    const type = String(form.get("type") ?? "service");
    const unit = String(form.get("unit") ?? "");
    const price = String(form.get("price") ?? "");
    const description = String(form.get("description") ?? "");
    const status = String(form.get("status") ?? "active");
    const errors = validateProductForm({
      name,
      sku,
      type,
      unit,
      price,
      description,
      status
    });
    formState.setFieldErrors(errors);
    formState.setFormError("");
    if (hasFormErrors(errors)) return;

    try {
      const input = {
        name: name.trim(),
        sku: sku.trim() || null,
        type: type as Product["type"],
        unit: unit.trim(),
        price: Number(price),
        description: description.trim() || null
      };

      if (editingProduct) {
        await crmMutations.updateProduct.mutateAsync({
          productId: editingProduct.id,
          input: {
            ...input,
            status: status as Product["status"]
          }
        });
      } else {
        await crmMutations.createProduct.mutateAsync({
          id: makeClientGeneratedId("product", name),
          ...input
        });
      }
      setIsModalOpen(false);
      setEditingProductId(null);
      formState.reset();
      props.onChanged(editingProduct ? "Товар/услуга обновлен" : "Товар/услуга создан");
    } catch (error) {
      formState.setFormError(getErrorMessage(error));
    }
  }

  function openCreateProduct() {
    setEditingProductId(null);
    formState.reset();
    setIsModalOpen(true);
  }

  function openEditProduct(productId: string) {
    setEditingProductId(productId);
    formState.reset();
    setIsModalOpen(true);
  }

  if (props.activeProductId) {
    return (
      <>
        <Panel
          title="Карточка товара или услуги"
          subtitle="CRM-позиция для будущего состава сделки, КП и документов."
          actions={
            <span className="table-actions">
              {canManageProducts && activeProduct ? (
                <button
                  className="primary-button"
                  disabled={isSaving}
                  type="button"
                  onClick={() => openEditProduct(activeProduct.id)}
                >
                  Редактировать
                </button>
              ) : null}
              <button className="secondary-button" type="button" onClick={props.onBack}>
                <ArrowLeft aria-hidden="true" size={14} />
                К списку товаров
              </button>
            </span>
          }
        >
          <SectionFeedback state={props.sectionState} emptyLabel="Товары и услуги недоступны." />
          {activeProduct ? (
            <div className="crm-card-layout">
              <section className="detail-card">
                <h2>{activeProduct.name}</h2>
                <dl className="detail-list">
                  <div>
                    <dt>Тип</dt>
                    <dd>{getProductTypeLabel(activeProduct.type)}</dd>
                  </div>
                  <div>
                    <dt>Артикул</dt>
                    <dd>{activeProduct.sku || "Не задан"}</dd>
                  </div>
                  <div>
                    <dt>Единица</dt>
                    <dd>{activeProduct.unit}</dd>
                  </div>
                  <div>
                    <dt>Цена</dt>
                    <dd>{formatMoney(activeProduct.price)}</dd>
                  </div>
                  <div>
                    <dt>Статус</dt>
                    <dd>{renderCrmStatus(activeProduct.status)}</dd>
                  </div>
                  <div>
                    <dt>Обновлено</dt>
                    <dd>{formatDate(activeProduct.updatedAt)}</dd>
                  </div>
                </dl>
              </section>
              <aside className="detail-card crm-side-panel">
                <h3>Использование</h3>
                <p className="muted">
                  Связь товаров со сделками будет добавлена отдельной моделью состава
                  сделки. Сейчас карточка хранит каталоговую позицию без fake actions.
                </p>
              </aside>
            </div>
          ) : (
            <p className="empty-state">Товар или услуга не найдены.</p>
          )}
        </Panel>
        {isModalOpen ? (
          <ProductModal
            error={formState.formError}
            fieldErrors={formState.fieldErrors}
            isSaving={isSaving}
            product={editingProduct}
            onClose={() => {
              if (isSaving) return;
              setIsModalOpen(false);
              setEditingProductId(null);
              formState.reset();
            }}
            onSubmit={submitProduct}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Panel
        title="Товары и услуги"
        subtitle="Каталог CRM-позиций. Это отдельная сущность, а не поле внутри сделки."
        actions={
          canManageProducts ? (
            <button className="primary-button" type="button" onClick={openCreateProduct}>
              <PlusCircle aria-hidden="true" size={15} />
              Создать позицию
            </button>
          ) : (
            <DisabledAction reason="Нужно право tenant.products.manage" />
          )
        }
      >
        <EntitySummary
          total={props.data.products.length}
          active={activeProducts}
          archived={props.data.products.length - activeProducts}
        />
        <CrudToolbar
          searchLabel="Поиск товаров и услуг"
          searchPlaceholder="Название, артикул, тип, цена..."
          searchValue={search}
          resultCount={filteredProducts.length}
          totalCount={props.data.products.length}
          onSearchChange={setSearch}
        >
          <span className="toolbar-chip">Каталог CRM</span>
        </CrudToolbar>
        <SectionFeedback state={props.sectionState} emptyLabel="Товары и услуги недоступны." />
        {canRenderSectionTable(props.sectionState) ? (
          <ProductsTable
            canManage={canManageProducts}
            products={filteredProducts}
            totalProducts={props.data.products.length}
            onEdit={openEditProduct}
            onOpen={props.onOpenProduct}
          />
        ) : null}
      </Panel>
      {isModalOpen ? (
        <ProductModal
          error={formState.formError}
          fieldErrors={formState.fieldErrors}
          isSaving={isSaving}
          product={editingProduct}
          onClose={() => {
            if (isSaving) return;
            setIsModalOpen(false);
            setEditingProductId(null);
            formState.reset();
          }}
          onSubmit={submitProduct}
        />
      ) : null}
    </>
  );
}


function ProductsTable(props: {
  canManage: boolean;
  products: Product[];
  totalProducts: number;
  onEdit: (productId: string) => void;
  onOpen: ((productId: string) => void) | undefined;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Товары и услуги">
        <thead>
          <tr>
            <th>Позиция</th>
            <th>Тип</th>
            <th>Единица</th>
            <th>Цена</th>
            <th>Статус</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {props.products.length === 0 ? (
            <TableEmpty
              colSpan={7}
              label={
                props.totalProducts === 0
                  ? "Товаров и услуг пока нет."
                  : "По фильтру ничего не найдено."
              }
            />
          ) : (
            props.products.map((product) => (
              <tr key={product.id}>
                <td>
                  <button
                    className="entity-row-link"
                    type="button"
                    onClick={() => props.onOpen?.(product.id)}
                  >
                    <EntityNameCell
                      avatar="Т"
                      primary={product.name}
                      secondary={product.sku ?? product.id}
                    />
                  </button>
                </td>
                <td>{getProductTypeLabel(product.type)}</td>
                <td>{product.unit}</td>
                <td>{formatMoney(product.price)}</td>
                <td>{renderCrmStatus(product.status)}</td>
                <td>{formatDate(product.updatedAt)}</td>
                <td>
                  <EntityActions
                    canManage={props.canManage}
                    entityId={product.id}
                    onEdit={props.onEdit}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}


function ProductModal(props: {
  product: Product | null;
  error: string;
  fieldErrors: FormErrors;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={props.product ? "Редактировать товар/услугу" : "Создать товар/услугу"}
      description="Позиция попадет в каталог CRM. Связь со сделками будет отдельным срезом."
      isDismissDisabled={props.isSaving}
      onClose={props.onClose}
    >
      <form className="stack-form" noValidate onSubmit={props.onSubmit}>
        <label htmlFor="product-name">
          Название
          <input
            id="product-name"
            name="name"
            aria-invalid={Boolean(props.fieldErrors.name)}
            data-autofocus
            defaultValue={props.product?.name ?? ""}
          />
          <FieldError formId="product" field="name" errors={props.fieldErrors} />
        </label>
        <div className="grid-3">
          <label htmlFor="product-sku">
            Артикул
            <input
              id="product-sku"
              name="sku"
              aria-invalid={Boolean(props.fieldErrors.sku)}
              defaultValue={props.product?.sku ?? ""}
            />
            <FieldError formId="product" field="sku" errors={props.fieldErrors} />
          </label>
          <label htmlFor="product-type">
            Тип
            <select
              id="product-type"
              name="type"
              aria-invalid={Boolean(props.fieldErrors.type)}
              defaultValue={props.product?.type ?? "service"}
            >
              <option value="service">Услуга</option>
              <option value="goods">Товар</option>
            </select>
            <FieldError formId="product" field="type" errors={props.fieldErrors} />
          </label>
          <label htmlFor="product-unit">
            Единица
            <input
              id="product-unit"
              name="unit"
              aria-invalid={Boolean(props.fieldErrors.unit)}
              defaultValue={props.product?.unit ?? "час"}
            />
            <FieldError formId="product" field="unit" errors={props.fieldErrors} />
          </label>
        </div>
        <label htmlFor="product-price">
          Цена, ₽
          <input
            id="product-price"
            name="price"
            inputMode="numeric"
            aria-invalid={Boolean(props.fieldErrors.price)}
            defaultValue={props.product?.price ?? ""}
          />
          <FieldError formId="product" field="price" errors={props.fieldErrors} />
        </label>
        <label htmlFor="product-description">
          Описание
          <textarea
            id="product-description"
            name="description"
            rows={3}
            aria-invalid={Boolean(props.fieldErrors.description)}
            defaultValue={props.product?.description ?? ""}
          />
          <FieldError formId="product" field="description" errors={props.fieldErrors} />
        </label>
        <EntityStatusField
          defaultValue={props.product?.status ?? "active"}
          formId="product"
          fieldErrors={props.fieldErrors}
        />
        <ModalActions
          error={props.error}
          isSaving={props.isSaving}
          primaryLabel={props.product ? "Сохранить позицию" : "Создать позицию"}
          savingLabel="Сохраняем..."
          onClose={props.onClose}
        />
      </form>
    </Modal>
  );
}

function getProductTypeLabel(type: Product["type"]): string {
  return type === "service" ? "Услуга" : "Товар";
}
